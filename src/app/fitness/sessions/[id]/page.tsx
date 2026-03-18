import { Suspense } from 'react';
import SessionDetailClient from './SessionDetailClient';

type SessionDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
    const { id } = await params;
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
            <SessionDetailClient id={id} />
        </Suspense>
    );
}

