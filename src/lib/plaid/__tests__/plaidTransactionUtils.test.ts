import {
    amountsMatch,
    datesWithinWindow,
    findConfidentPendingMatch,
    mapPlaidAmount,
    merchantLabelsMatch,
    spendNotificationIdempotencyKey,
    isSpendingAmount,
} from '@/lib/plaid/plaidTransactionUtils';

describe('mapPlaidAmount', () => {
    it('inverts Plaid sign for app convention', () => {
        expect(mapPlaidAmount(18.42)).toBe(-18.42);
        expect(mapPlaidAmount(-100)).toBe(100);
    });
});

describe('isSpendingAmount', () => {
    it('treats negative amounts as spending', () => {
        expect(isSpendingAmount(-10)).toBe(true);
        expect(isSpendingAmount(10)).toBe(false);
    });
});

describe('spendNotificationIdempotencyKey', () => {
    it('uses canonical id in key', () => {
        expect(
            spendNotificationIdempotencyKey('user-1', 'pending-tx-abc')
        ).toBe('transaction_spend_alert:user-1:pending-tx-abc');
    });
});

describe('findConfidentPendingMatch', () => {
    const candidates = [
        {
            id: 'row-1',
            date: '2026-05-20',
            amount: -18.42,
            name: 'Chick-fil-A',
            note: 'Chick-fil-A',
            pending: true,
            notified_at: '2026-05-20T12:00:00Z',
            plaid_transaction_id: 'pending-abc',
            original_pending_transaction_id: 'pending-abc',
        },
    ];

    it('matches posted spend to pending by merchant and amount', () => {
        const match = findConfidentPendingMatch(
            {
                accountId: 'acct-1',
                date: '2026-05-21',
                amount: -18.42,
                name: 'Chick-fil-A',
                merchantName: 'Chick-fil-A',
            },
            candidates
        );
        expect(match?.id).toBe('row-1');
    });

    it('returns null when amount differs', () => {
        const match = findConfidentPendingMatch(
            {
                accountId: 'acct-1',
                date: '2026-05-21',
                amount: -99,
                name: 'Chick-fil-A',
                merchantName: 'Chick-fil-A',
            },
            candidates
        );
        expect(match).toBeNull();
    });
});

describe('merchantLabelsMatch', () => {
    it('matches exact and substring labels', () => {
        expect(merchantLabelsMatch('Starbucks', null, 'STARBUCKS STORE', null)).toBe(true);
        expect(merchantLabelsMatch('A', null, 'B', null)).toBe(false);
    });
});

describe('amountsMatch and datesWithinWindow', () => {
    it('compares amounts within tolerance', () => {
        expect(amountsMatch(-18.42, -18.419)).toBe(true);
    });

    it('allows dates within window', () => {
        expect(datesWithinWindow('2026-05-20', '2026-05-22', 5)).toBe(true);
        expect(datesWithinWindow('2026-05-01', '2026-05-20', 5)).toBe(false);
    });
});
