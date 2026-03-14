'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Detects auth errors in the URL hash (e.g. from Supabase email link redirects).
 * Hash params like #error=... are not sent to the server, so we handle them client-side
 * and redirect to login with a user-friendly message.
 */
export function AuthHashErrorHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash?.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const error = params.get('error');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    if (!error) return;

    // Map known Supabase error codes to friendly messages
    const message =
      errorCode === 'otp_expired'
        ? 'The confirmation link has expired. Please request a new one by signing up again.'
        : errorDescription?.replace(/\+/g, ' ') || 'Authentication failed. Please try again.';

    // Clear the hash and redirect to login
    const url = new URL(window.location.href);
    url.hash = '';
    url.pathname = '/login';
    url.searchParams.set('error', message);
    router.replace(url.pathname + url.search);
  }, [router]);

  return null;
}
