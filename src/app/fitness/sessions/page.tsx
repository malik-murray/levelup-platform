import { Suspense } from 'react';
import SessionsListClient from './SessionsListClient';

export default function SessionsListPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <SessionsListClient />
        </Suspense>
    );
}

