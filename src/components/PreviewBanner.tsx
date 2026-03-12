'use client';

import Link from 'next/link';

export default function PreviewBanner() {
  return (
    <div className="bg-amber-500/90 text-black border-b border-amber-600/50">
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm font-medium">
        <span className="font-semibold">Preview Mode</span>
        <span className="text-amber-900/80">— Your data is saved only in this browser.</span>
        <Link
          href="/login?redirect=/onboarding/preview"
          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
        >
          Create Account to Save & Sync
        </Link>
      </div>
    </div>
  );
}
