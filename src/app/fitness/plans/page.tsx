import { Suspense } from 'react';
import PlansListClient from './PlansListClient';

export default function PlansListPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <PlansListClient />
        </Suspense>
    );
}

