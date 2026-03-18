import { Suspense } from 'react';
import MuscleClient from './MuscleClient';

type MusclePageProps = {
    params: Promise<{ slug: string }>;
};

export default async function MusclePage({ params }: MusclePageProps) {
    const { slug } = await params;
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <MuscleClient slug={slug} />
        </Suspense>
    );
}

