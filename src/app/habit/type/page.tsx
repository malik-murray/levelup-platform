import { Suspense } from 'react';
import HabitTypeClient from './HabitTypeClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitTypePage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitTypeClient />
    </Suspense>
  );
}
