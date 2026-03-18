import { Suspense } from 'react';
import ExercisesTestClient from './ExercisesTestClient';

export default function ExercisesTestPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <ExercisesTestClient />
        </Suspense>
    );
}
