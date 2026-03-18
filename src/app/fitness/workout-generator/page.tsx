import { Suspense } from 'react';
import WorkoutGeneratorClient from './WorkoutGeneratorClient';

export default function WorkoutGeneratorPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <WorkoutGeneratorClient />
        </Suspense>
    );
}

