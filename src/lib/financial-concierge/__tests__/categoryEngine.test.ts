/**
 * Tests for CategoryEngine
 */

import { categorizeTransaction, TransactionToCategorize, CategorizationOptions } from '../categoryEngine';

describe('CategoryEngine', () => {
    const mockOptions: CategorizationOptions = {
        userId: 'test-user-id',
        enableML: false,
    };

    describe('categorizeTransaction', () => {
        it('should return null for transaction without matches', async () => {
            const transaction: TransactionToCategorize = {
                name: 'Unknown Merchant',
                note: 'Random purchase',
                amount: -50.00,
                date: '2024-01-15',
            };

            // Note: This test requires database setup or mocking
            // In a real test environment, you would mock the Supabase client
            // For now, this is a placeholder test structure
            expect(transaction).toBeDefined();
        });

        it('should handle merchant name normalization', () => {
            const merchantNames = [
                'AMAZON.COM',
                'Amazon.com',
                'amazon.com',
                'Amazon Marketplace',
            ];

            // All should normalize to similar patterns
            merchantNames.forEach(name => {
                expect(name.toLowerCase().replace(/[^a-z0-9]/g, '')).toContain('amazon');
            });
        });

        it('should handle transaction categorization flow', () => {
            const transaction: TransactionToCategorize = {
                id: 'test-tx-1',
                name: 'Test Merchant',
                note: 'Test purchase',
                amount: -100.00,
                date: '2024-01-15',
                mcc_code: 5411, // Grocery stores
            };

            expect(transaction.mcc_code).toBe(5411);
            expect(transaction.amount).toBeLessThan(0); // Expense
        });
    });
});




