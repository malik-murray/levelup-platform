import { Suspense } from 'react';
import HabitIconClient from './HabitIconClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitIconPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitIconClient />
    </Suspense>
  );
}
