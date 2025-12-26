/**
 * Formats a number as currency with thousands separators (commas)
 * @param amount - The amount to format (can be positive or negative)
 * @returns Formatted string like "$12,305.12" or "-$1,234.56"
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Formats a number as currency without the currency symbol (for cases where $ is already present)
 * @param amount - The amount to format (should be positive)
 * @returns Formatted string like "12,305.12"
 */
export function formatCurrencyAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(amount));
}









