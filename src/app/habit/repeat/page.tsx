import { Suspense } from 'react';
import HabitRepeatClient from './HabitRepeatClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitRepeatPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitRepeatClient />
    </Suspense>
  );
}
