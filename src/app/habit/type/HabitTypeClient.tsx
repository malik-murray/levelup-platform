'use client';

import { useSearchParams } from 'next/navigation';
import { TypeSelectorScreen } from '../components/grit/TypeSelectorScreen';

export default function HabitTypeClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <TypeSelectorScreen returnTo={returnTo} />;
}

