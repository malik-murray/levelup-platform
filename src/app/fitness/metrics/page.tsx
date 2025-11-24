import { Suspense } from 'react';
import MetricsClient from './MetricsClient';

type MetricsPageProps = {
    searchParams: { [key: string]: string | string[] | undefined };
};

export default function MetricsPage({ searchParams }: MetricsPageProps) {
    const dateParam = searchParams?.date;
    const date = typeof dateParam === 'string' ? dateParam : (Array.isArray(dateParam) ? dateParam[0] : undefined);
    
    const showFormParam = searchParams?.showForm;
    const showFormFromParam = showFormParam === 'true' || (Array.isArray(showFormParam) && showFormParam[0] === 'true');
    const showForm = showFormFromParam || date === 'today' || !!date;

    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading metrics...</div>}>
            <MetricsClient initialDate={date} initialShowForm={showForm} />
        </Suspense>
    );
}
