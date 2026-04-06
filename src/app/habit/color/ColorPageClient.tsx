'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ColorPickerScreen } from '../components/grit/ColorPickerScreen';
import { HabitFlowLoading } from '../components/HabitFlowShell';

function ColorPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <ColorPickerScreen returnTo={returnTo} />;
}

export default function ColorPageClient() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <ColorPageInner />
    </Suspense>
  );
}

