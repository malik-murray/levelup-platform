import { Suspense } from 'react';
import CaloriesClient from './CaloriesClient';

export default function CaloriesPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <CaloriesClient />
        </Suspense>
    );
}
