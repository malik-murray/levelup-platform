import type { NextRequest } from 'next/server';

/**
 * Authorize scheduled jobs from Vercel Cron or an external pinger.
 * Set CRON_SECRET in Vercel — Vercel sends Authorization: Bearer {CRON_SECRET} automatically.
 */
export function authorizeCronRequest(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
        console.error('[cron] CRON_SECRET is not configured — background sync will not run');
        return false;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) {
        return true;
    }

    const headerSecret = request.headers.get('x-cron-secret');
    if (headerSecret === cronSecret) {
        return true;
    }

    return false;
}

export function isCronConfigured(): boolean {
    return Boolean(process.env.CRON_SECRET?.trim());
}
