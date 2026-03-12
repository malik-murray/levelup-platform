'use client';

import { useSearchParams } from 'next/navigation';
import { RepeatScreen } from '../components/grit/RepeatScreen';

export default function HabitRepeatClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <RepeatScreen returnTo={returnTo} />;
}

