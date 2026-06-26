'use client';

import { Suspense } from 'react';
import HabitGoalClient from './HabitGoalClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitGoalPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitGoalClient />
    </Suspense>
  );
}
