'use client';

import { useSearchParams } from 'next/navigation';
import { CategoryPickerScreen } from '../components/grit/CategoryPickerScreen';

export default function HabitCategoriesClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <CategoryPickerScreen returnTo={returnTo} />;
}
