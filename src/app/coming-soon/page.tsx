import ComingSoonPageClient from './ComingSoonPageClient';
import { isComingSoonAppKey } from '@/lib/comingSoonApps';

export default async function ComingSoonPage({
    searchParams,
}: {
    searchParams: Promise<{ app?: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const raw = params.app;
    const appParam = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    const appKey = appParam && isComingSoonAppKey(appParam) ? appParam : null;

    return <ComingSoonPageClient appKey={appKey} />;
}
