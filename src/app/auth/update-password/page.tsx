'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      setLoading(false);
      if (error || !user) {
        router.replace('/login?error=Session+expired.+Please+request+a+new+reset+link.');
      }
    });
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password updated. Redirecting…');
    router.replace('/dashboard');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
        <h1 className="mb-6 text-xl sm:text-2xl font-semibold text-center">
          Set new password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-semibold text-black hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm px-2 ${
              message.includes('updated') ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/login" className="underline hover:text-slate-300">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
