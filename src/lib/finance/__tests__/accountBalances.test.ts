import {
    getAccountBalanceDetails,
    getAccountGroup,
    getAvailableCredit,
    getCreditDebtOwed,
    getSpendableTotal,
} from '../accountBalances';

describe('getAccountGroup', () => {
    it('maps account types to display groups', () => {
        expect(getAccountGroup('checking')).toBe('spending');
        expect(getAccountGroup('cash')).toBe('spending');
        expect(getAccountGroup('savings')).toBe('savings');
        expect(getAccountGroup('investment')).toBe('investing');
        expect(getAccountGroup('credit')).toBe('credit');
        expect(getAccountGroup('other')).toBe('spending');
        expect(getAccountGroup(null)).toBe('spending');
    });
});

describe('getAccountBalanceDetails', () => {
    it('keeps asset balances unchanged', () => {
        const result = getAccountBalanceDetails('checking', 1000, -250);
        expect(result.signedBalance).toBe(750);
        expect(result.displayBalance).toBe(750);
        expect(result.usedLiveBalance).toBe(false);
    });

    it('prefers live institution balance over starting + txs', () => {
        const result = getAccountBalanceDetails('checking', 1000, -250, {
            liveBalance: 5400.36,
        });
        expect(result.signedBalance).toBe(5400.36);
        expect(result.displayBalance).toBe(5400.36);
        expect(result.usedLiveBalance).toBe(true);
    });

    it('shows credit as zero when idle', () => {
        const result = getAccountBalanceDetails('credit', 0, 0);
        expect(result.displayBalance).toBe(0);
        expect(result.signedBalance).toBe(0);
    });

    it('shows credit spending as negative', () => {
        const result = getAccountBalanceDetails('credit', 0, -150);
        expect(result.displayBalance).toBe(-150);
        expect(result.signedBalance).toBe(-150);
    });

    it('treats positive starting balance as existing debt', () => {
        const result = getAccountBalanceDetails('credit', 500, -100);
        expect(result.displayBalance).toBe(-600);
        expect(result.signedBalance).toBe(-600);
    });

    it('uses live credit balance as amount owed', () => {
        const result = getAccountBalanceDetails('credit', 500, -100, { liveBalance: 1117.99 });
        expect(result.displayBalance).toBe(-1117.99);
        expect(result.signedBalance).toBe(-1117.99);
        expect(result.usedLiveBalance).toBe(true);
    });
});

describe('available credit / spendable', () => {
    it('computes debt owed from signed credit balance', () => {
        expect(getCreditDebtOwed(-400)).toBe(400);
        expect(getCreditDebtOwed(0)).toBe(0);
        expect(getCreditDebtOwed(50)).toBe(0);
    });

    it('computes available credit from limit − debt', () => {
        expect(getAvailableCredit(5000, 1200)).toBe(3800);
        expect(getAvailableCredit(1000, 1500)).toBe(0);
        expect(getAvailableCredit(null, 100)).toBeNull();
    });

    it('sums liquid cash + available credit as spendable', () => {
        expect(getSpendableTotal(2000, 3800)).toBe(5800);
        expect(getSpendableTotal(-10, 100)).toBe(100);
    });
});
