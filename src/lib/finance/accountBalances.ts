export type AccountType =
    | 'checking'
    | 'savings'
    | 'credit'
    | 'cash'
    | 'investment'
    | 'other';

/** How accessible funds in an account are. */
export type AccountLiquidity = 'liquid' | 'reserved' | 'locked';

export const ACCOUNT_LIQUIDITY_ORDER: AccountLiquidity[] = [
    'liquid',
    'reserved',
    'locked',
];

export const ACCOUNT_LIQUIDITY_LABELS: Record<AccountLiquidity, string> = {
    liquid: 'Liquid',
    reserved: 'Reserved',
    locked: 'Locked',
};

export const ACCOUNT_LIQUIDITY_HINTS: Record<AccountLiquidity, string> = {
    liquid: 'Can withdraw anytime',
    reserved: 'Earmarked but accessible',
    locked: 'Retirement / long-term — don’t touch',
};

export const ACCOUNT_LIQUIDITY_COLORS: Record<AccountLiquidity, string> = {
    liquid: '#34d399',
    reserved: '#fbbf24',
    locked: '#818cf8',
};

export function isAccountLiquidity(value: unknown): value is AccountLiquidity {
    return value === 'liquid' || value === 'reserved' || value === 'locked';
}

/** Default liquidity when creating/backfilling by account type. */
export function defaultLiquidityForType(
    type: AccountType | null | undefined
): AccountLiquidity | null {
    switch (type) {
        case 'checking':
        case 'cash':
            return 'liquid';
        case 'savings':
            return 'reserved';
        case 'investment':
            return 'locked';
        case 'credit':
            return null;
        default:
            return null;
    }
}

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
    /** True when balance came from an institution live balance (e.g. Plaid). */
    usedLiveBalance: boolean;
};

export type AccountBalanceOptions = {
    /**
     * Latest institution-reported balance (Plaid `balances.current`).
     * When set, this is the source of truth for display — do not also add transaction nets
     * (those are already reflected in the live balance).
     */
    liveBalance?: number | null;
};

export function getAccountBalanceDetails(
    type: AccountType | null,
    startingBalance: number | null,
    netChange: number,
    options: AccountBalanceOptions = {}
): AccountBalanceDetails {
    const starting = Number(startingBalance ?? 0);
    const live =
        options.liveBalance === null || options.liveBalance === undefined
            ? null
            : Number(options.liveBalance);

    if (live !== null && Number.isFinite(live)) {
        if (type === 'credit') {
            // Plaid credit `current` is typically the positive amount owed.
            const debt = Math.max(0, live);
            const signedBalance = debt === 0 ? 0 : -debt;
            return {
                starting,
                netChange,
                rawBalance: debt,
                signedBalance,
                displayBalance: signedBalance,
                usedLiveBalance: true,
            };
        }

        return {
            starting,
            netChange,
            rawBalance: live,
            signedBalance: live,
            displayBalance: live,
            usedLiveBalance: true,
        };
    }

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
            usedLiveBalance: false,
        };
    }

    const rawBalance = starting + netChange;
    return {
        starting,
        netChange,
        rawBalance,
        signedBalance: rawBalance,
        displayBalance: rawBalance,
        usedLiveBalance: false,
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
