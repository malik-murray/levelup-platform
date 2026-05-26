/** Plaid item errors where automatic sync should pause until the user reconnects. */
const REAUTH_ERROR_CODES = new Set([
    'ITEM_LOGIN_REQUIRED',
    'INVALID_ACCESS_TOKEN',
    'ITEM_NOT_FOUND',
    'NO_ACCOUNTS',
    'INSUFFICIENT_CREDENTIALS',
    'USER_SETUP_REQUIRED',
]);

export function plaidItemNeedsReauth(errorCode: string | null | undefined): boolean {
    return Boolean(errorCode && REAUTH_ERROR_CODES.has(errorCode));
}
