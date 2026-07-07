import { Suspense } from 'react';
import UpgradePageClient from './UpgradePageClient';

export default function UpgradePage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-dvh items-center justify-center bg-[#010205] text-white">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                </main>
            }
        >
            <UpgradePageClient />
        </Suspense>
    );
}
