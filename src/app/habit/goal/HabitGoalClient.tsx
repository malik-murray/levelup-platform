'use client';

import { useSearchParams } from 'next/navigation';
import { GoalPickerScreen } from '../components/grit/GoalPickerScreen';

export default function HabitGoalClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <GoalPickerScreen returnTo={returnTo} />;
}
