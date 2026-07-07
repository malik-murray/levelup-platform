import { Suspense } from 'react';
import QuickLogClient from './QuickLogClient';

export default function WorkoutsPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading quick log...</div>}>
            <QuickLogClient />
        </Suspense>
    );
}
