import { Suspense } from 'react';
import HabitCategoriesClient from './HabitCategoriesClient';
import { HabitFlowLoading } from '../components/HabitFlowShell';

export default function HabitCategoriesPage() {
  return (
    <Suspense fallback={<HabitFlowLoading />}>
      <HabitCategoriesClient />
    </Suspense>
  );
}
