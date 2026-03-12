'use client';

import { useSearchParams } from 'next/navigation';
import { GroupsScreen } from '../components/grit/GroupsScreen';

export default function HabitGroupsPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';
  return <GroupsScreen />;
}
