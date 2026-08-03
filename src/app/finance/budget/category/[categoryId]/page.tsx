'use client';

import { Suspense } from 'react';
import BudgetCategoryDetailPage from './CategoryDetailClient';

export default function Page() {
    return (
        <Suspense
            fallback={
                <section className="space-y-4 px-6 py-4">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
                        Loading…
                    </div>
                </section>
            }
        >
            <BudgetCategoryDetailPage />
        </Suspense>
    );
}
