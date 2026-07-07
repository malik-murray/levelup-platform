/**
 * Comma-separated emails that always receive full app access (for testing / founders).
 * Example: FULL_ACCESS_EMAILS=you@example.com,teammate@example.com
 */
export function getFullAccessEmails(): string[] {
    const raw = process.env.FULL_ACCESS_EMAILS ?? process.env.NEXT_PUBLIC_FULL_ACCESS_EMAILS ?? '';
    return raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

export function isFullAccessEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return getFullAccessEmails().includes(email.trim().toLowerCase());
}
