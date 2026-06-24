export type AccountType =
    | 'checking'
    | 'savings'
    | 'credit'
    | 'cash'
    | 'investment'
    | 'other';

export type AccountGroup = 'spending' | 'savings' | 'investing' | 'credit';

export const ACCOUNT_GROUP_ORDER: AccountGroup[] = [
    'spending',
    'savings',
    'investing',
    'credit',
];

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
    spending: 'Spending',
    savings: 'Savings',
    investing: 'Investing',
    credit: 'Credit',
};

export function getAccountGroup(type: AccountType | null): AccountGroup {
    switch (type) {
        case 'savings':
            return 'savings';
        case 'investment':
            return 'investing';
        case 'credit':
            return 'credit';
        case 'checking':
        case 'cash':
        default:
            return 'spending';
    }
}

export type AccountBalanceDetails = {
    starting: number;
    netChange: number;
    rawBalance: number;
    /** Signed balance for net worth (liabilities negative). */
    signedBalance: number;
    /** Balance shown in account lists (credit: zero or negative only). */
    displayBalance: number;
};

export function getAccountBalanceDetails(
    type: AccountType | null,
    startingBalance: number | null,
    netChange: number
): AccountBalanceDetails {
    const starting = Number(startingBalance ?? 0);

    if (type === 'credit') {
        const debt = Math.max(0, starting) - netChange;
        const signedBalance = debt === 0 ? 0 : -debt;
        const displayBalance =
            starting === 0 && netChange === 0
                ? 0
                : Math.min(0, -Math.max(0, debt));

        return {
            starting,
            netChange,
            rawBalance: debt,
            signedBalance,
            displayBalance,
        };
    }

    const rawBalance = starting + netChange;
    return {
        starting,
        netChange,
        rawBalance,
        signedBalance: rawBalance,
        displayBalance: rawBalance,
    };
}

export function getAccountGroupIcon(group: AccountGroup): string {
    switch (group) {
        case 'investing':
            return '📈';
        case 'savings':
            return '🏦';
        case 'credit':
            return '💳';
        default:
            return '🏧';
    }
}
