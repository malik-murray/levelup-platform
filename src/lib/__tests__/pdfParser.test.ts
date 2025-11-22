import { parsePdfTransactions } from '../pdfParser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PDF Parser', () => {
    // Note: This test requires the actual PDF file to be present
    // Place august_2025_monthly_statement.pdf in the project root or adjust path
    const pdfPath = join(process.cwd(), 'august_2025_monthly_statement.pdf');

    test('should parse Navy Federal statement without errors', async () => {
        // Skip if PDF file doesn't exist (for CI environments)
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            // Should find header and parse transactions
            expect(transactions.length).toBeGreaterThan(40);
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });

    test('should extract more than 40 transactions from August 2025 statement', async () => {
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            expect(transactions.length).toBeGreaterThan(40);
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });

    test('should not include transactions from Items Paid section', async () => {
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            // None of the descriptions should be just "ACH" or "POS" (Items Paid format)
            const itemsPaidDescriptions = transactions.filter(
                tx => tx.description.toUpperCase() === 'ACH' || tx.description.toUpperCase() === 'POS'
            );
            expect(itemsPaidDescriptions.length).toBe(0);
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });

    test('should parse known transactions correctly', async () => {
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            // Check for known transactions
            // Beginning balance around 3,418.17
            const beginningBalance = transactions.find(
                tx => Math.abs(tx.amount - 3418.17) < 0.01 || Math.abs(tx.amount - 3418.17) < 0.01
            );
            // Note: Beginning balance might be skipped, so this is optional

            // POS debit for Amazon around 117.55 (negative)
            const amazonTransaction = transactions.find(
                tx => tx.description.toLowerCase().includes('amazon') && 
                      Math.abs(Math.abs(tx.amount) - 117.55) < 0.01 &&
                      tx.amount < 0
            );
            expect(amazonTransaction).toBeDefined();
            expect(amazonTransaction!.amount).toBeCloseTo(-117.55, 2);

            // ACH deposit around 2,171.41 (positive)
            const achDeposit = transactions.find(
                tx => tx.description.toLowerCase().includes('paid from') &&
                      Math.abs(tx.amount - 2171.41) < 0.01 &&
                      tx.amount > 0
            );
            expect(achDeposit).toBeDefined();
            expect(achDeposit!.amount).toBeCloseTo(2171.41, 2);
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });

    test('should ignore Items Paid section', async () => {
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            // All transactions should have meaningful descriptions (not just "ACH" or "POS")
            transactions.forEach(tx => {
                expect(tx.description.length).toBeGreaterThan(3);
                expect(tx.description.toUpperCase()).not.toBe('ACH');
                expect(tx.description.toUpperCase()).not.toBe('POS');
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });

    test('should parse dates correctly as YYYY-MM-DD', async () => {
        try {
            const pdfBuffer = readFileSync(pdfPath);
            const transactions = await parsePdfTransactions(pdfBuffer);

            transactions.forEach(tx => {
                // Date should be in ISO format YYYY-MM-DD
                expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                const [year, month, day] = tx.date.split('-').map(Number);
                expect(year).toBe(2025); // August 2025 statement
                expect(month).toBeGreaterThanOrEqual(7);
                expect(month).toBeLessThanOrEqual(8);
                expect(day).toBeGreaterThanOrEqual(1);
                expect(day).toBeLessThanOrEqual(31);
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.log('PDF file not found, skipping test');
                return;
            }
            throw error;
        }
    });
});


