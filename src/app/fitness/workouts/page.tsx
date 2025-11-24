import { Suspense } from 'react';
import WorkoutsClient from './WorkoutsClient';

type WorkoutsPageProps = {
    searchParams: { [key: string]: string | string[] | undefined };
};

export default function WorkoutsPage({ searchParams }: WorkoutsPageProps) {
    const addParam = searchParams?.add;
    const showAddForm = addParam === 'true' || (Array.isArray(addParam) && addParam[0] === 'true');

    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading workouts...</div>}>
            <WorkoutsClient initialShowForm={showAddForm} />
        </Suspense>
    );
}
