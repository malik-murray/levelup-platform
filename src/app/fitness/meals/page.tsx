import { Suspense } from 'react';
import MealsClient from './MealsClient';

type MealsPageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MealsPage({ searchParams }: MealsPageProps) {
    const addParam = (await searchParams).add;
    const showAddForm = addParam === 'true' || (Array.isArray(addParam) && addParam[0] === 'true');

    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading meals...</div>}>
            <MealsClient initialShowForm={showAddForm} />
        </Suspense>
    );
}
