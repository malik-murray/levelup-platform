'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ColorPickerScreen } from '../components/grit/ColorPickerScreen';

function ColorPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <ColorPickerScreen returnTo={returnTo} />;
}

export default function ColorPageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ColorPageInner />
    </Suspense>
  );
}

