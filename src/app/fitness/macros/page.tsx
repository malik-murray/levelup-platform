import { Suspense } from 'react';
import MacrosClient from './MacrosClient';

export default function MacrosPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <MacrosClient />
        </Suspense>
    );
}
