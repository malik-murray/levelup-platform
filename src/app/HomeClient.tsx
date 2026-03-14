'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Handles redirect from / when there's no session. Runs client-side so we can
 * read the URL hash (e.g. #error=otp_expired from Supabase) before redirecting.
 * Server redirects would drop the hash.
 */
export default function HomeClient() {
  const router = useRouter();

  useEffect(() => {
    // Check for auth errors in hash (Supabase sends these when verification fails)
    const hash = window.location.hash?.slice(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const error = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (error) {
        const message =
          errorCode === 'otp_expired'
            ? 'The confirmation link has expired. Please request a new one by signing up again.'
            : errorDescription?.replace(/\+/g, ' ') || 'Authentication failed. Please try again.';
        router.replace(`/login?error=${encodeURIComponent(message)}`);
        return;
      }
    }

    router.replace('/landing');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}
