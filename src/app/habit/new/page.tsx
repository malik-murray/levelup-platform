import { Suspense } from 'react';
import NewHabitClient from './NewHabitClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function NewHabitPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <NewHabitClient />
    </Suspense>
  );
}
