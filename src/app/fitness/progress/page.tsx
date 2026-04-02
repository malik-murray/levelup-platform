import { Suspense } from 'react';
import ProgressClient from './ProgressClient';

export default function ProgressPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <ProgressClient />
        </Suspense>
    );
}
