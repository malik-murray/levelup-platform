'use client';

import { useSearchParams } from 'next/navigation';
import { IconPickerScreen } from '../components/grit/IconPickerScreen';

export default function HabitIconClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <IconPickerScreen returnTo={returnTo} />;
}

