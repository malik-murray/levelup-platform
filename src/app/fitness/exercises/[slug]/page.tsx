import { Suspense } from 'react';
import ExerciseDetailClient from './ExerciseDetailClient';

type ExerciseDetailPageProps = {
    params: Promise<{ slug: string }>;
};

export default async function ExerciseDetailPage({ params }: ExerciseDetailPageProps) {
    const { slug } = await params;
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <ExerciseDetailClient slug={slug} />
        </Suspense>
    );
}
