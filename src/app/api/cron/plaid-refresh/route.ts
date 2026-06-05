/** @deprecated Use /api/cron/plaid-sync — refresh runs there when eligible. */
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export { GET, POST } from '../plaid-sync/route';
