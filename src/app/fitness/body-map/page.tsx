import { Suspense } from 'react';
import BodyMapClient from './BodyMapClient';

export default function BodyMapPage() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-400">Loading body map…</div>}>
            <BodyMapClient />
        </Suspense>
    );
}

