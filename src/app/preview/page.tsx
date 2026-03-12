'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PreviewEntryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/preview/dashboard');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );
}
