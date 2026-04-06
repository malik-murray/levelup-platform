import { Suspense } from 'react';
import HabitGroupsClient from './HabitGroupsClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitGroupsPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitGroupsClient />
    </Suspense>
  );
}
