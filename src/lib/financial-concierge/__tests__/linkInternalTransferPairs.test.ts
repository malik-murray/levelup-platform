import { findOppositeAccountTransferPairs } from '../linkInternalTransferPairs';

describe('findOppositeAccountTransferPairs', () => {
    it('pairs opposite amounts same day different accounts', () => {
        const pairs = findOppositeAccountTransferPairs([
            {
                id: 'a',
                date: '2026-05-01',
                amount: -100,
                account_id: 'acc1',
                name: 'Out',
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                category_id: null,
            },
            {
                id: 'b',
                date: '2026-05-01',
                amount: 100,
                account_id: 'acc2',
                name: 'In',
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                category_id: null,
            },
        ]);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].neg.id).toBe('a');
        expect(pairs[0].pos.id).toBe('b');
    });

    it('does not pair same account', () => {
        const pairs = findOppositeAccountTransferPairs([
            {
                id: 'a',
                date: '2026-05-01',
                amount: -50,
                account_id: 'acc1',
                name: null,
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                category_id: null,
            },
            {
                id: 'b',
                date: '2026-05-01',
                amount: 50,
                account_id: 'acc1',
                name: null,
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                category_id: null,
            },
        ]);
        expect(pairs).toHaveLength(0);
    });

    it('ignores already-linked rows', () => {
        const pairs = findOppositeAccountTransferPairs([
            {
                id: 'a',
                date: '2026-05-01',
                amount: -100,
                account_id: 'acc1',
                name: null,
                note: null,
                is_transfer: true,
                transfer_group_id: 'g1',
                category_id: null,
            },
            {
                id: 'b',
                date: '2026-05-01',
                amount: 100,
                account_id: 'acc2',
                name: null,
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                category_id: null,
            },
        ]);
        expect(pairs).toHaveLength(0);
    });
});
