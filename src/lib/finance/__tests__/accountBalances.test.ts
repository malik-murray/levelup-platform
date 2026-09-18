import {
    getAccountBalanceDetails,
    getAccountGroup,
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
