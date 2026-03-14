'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam) setMessage(errorParam.replace(/\+/g, ' '));
  }, [errorParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setMessage(error.message);
      else setMessage('Check your email to confirm your account.');
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) setMessage(error.message);
      else setMessage('Check your email for a link to reset your password.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = redirectTo;
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
        <h1 className="mb-6 text-xl sm:text-2xl font-semibold text-center">
          {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create an account' : 'Reset password'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {mode !== 'forgot' && (
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          )}
          {mode === 'login' && (
            <button
              type="button"
              className="w-full text-left text-sm text-slate-400 underline hover:text-slate-300"
              onClick={() => { setMode('forgot'); setMessage(null); }}
            >
              Forgot password?
            </button>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-semibold text-black hover:bg-emerald-400 active:bg-emerald-600 transition-colors"
          >
            {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-center text-sm px-2 ${mode === 'forgot' && message.includes('Check your email') ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        <button
          type="button"
          className="mt-6 w-full text-sm sm:text-xs text-slate-300 underline py-2 active:opacity-70"
          onClick={() => {
            setMode(prev => (prev === 'forgot' ? 'login' : prev === 'login' ? 'signup' : 'login'));
            setMessage(null);
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : mode === 'signup'
              ? 'Already have an account? Log in'
              : 'Back to log in'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          <a href="/preview" className="underline hover:text-amber-400">Try the app</a> without an account
        </p>
      </div>
    </main>
  );
}

