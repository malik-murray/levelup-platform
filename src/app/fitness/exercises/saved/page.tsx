import { Suspense } from 'react';
import SavedExercisesClient from './SavedExercisesClient';

export default function SavedExercisesPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading saved exercises…</div>}>
            <SavedExercisesClient />
        </Suspense>
    );
}

