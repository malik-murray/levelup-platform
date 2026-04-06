'use client';

import { useState } from 'react';
import { Outfit } from 'next/font/google';
import { trendsHero } from '@/lib/trends/trendsCopy';
import TrendsLayoutShell from '@/app/trends/components/TrendsLayoutShell';
import TrendsPageContent from '@/app/trends/components/TrendsPageContent';
import { useTrendsPageData } from '@/app/trends/useTrendsPageData';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });

export default function TrendsPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const data = useTrendsPageData();

    if (data.loading) {
        return (
            <main
                className={`${outfit.className} flex min-h-dvh items-center justify-center bg-[#010205] text-white`}
            >
                <div className="text-center">
                    <div
                        className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent"
                        aria-hidden
                    />
                    <p className="text-sm text-slate-400">{trendsHero.loading}</p>
                </div>
            </main>
        );
    }

    const { loading: _loading, ...model } = data;

    return (
        <div className={`${outfit.className} min-w-0 max-w-full overflow-x-clip`}>
            <TrendsLayoutShell
                title="Trends & analysis"
                subtitle="Score rings for the window you pick"
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
            >
                <TrendsPageContent model={model} />
            </TrendsLayoutShell>
        </div>
    );
}
