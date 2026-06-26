'use client';

import { useState } from 'react';
import { Outfit } from 'next/font/google';
import TrendsLayoutShell from '@/app/trends/components/TrendsLayoutShell';
import GoalsPageContent from '@/app/goals/components/GoalsPageContent';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });

export default function GoalsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`${outfit.className} min-w-0 max-w-full overflow-x-clip`}>
      <TrendsLayoutShell
        title="Goals & Vision"
        subtitle="Your north star — track progress across habits, tasks, and milestones"
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      >
        <GoalsPageContent />
      </TrendsLayoutShell>
    </div>
  );
}
