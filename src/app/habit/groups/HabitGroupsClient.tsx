'use client';

import { useSearchParams } from 'next/navigation';
import { GroupsScreen } from '../components/grit/GroupsScreen';

export default function HabitGroupsClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  return <GroupsScreen returnTo={returnTo} />;
}

