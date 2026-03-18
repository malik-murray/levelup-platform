import { Suspense } from 'react';
import PlanDetailClient from './PlanDetailClient';

type PlanDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
    const { id } = await params;
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <PlanDetailClient id={id} />
        </Suspense>
    );
}

