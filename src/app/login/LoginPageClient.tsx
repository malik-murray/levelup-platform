'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

const LOGO_SRC = '/brand/levelup-logo.png';

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modeOverride, setModeOverride] = useState<'login' | 'signup' | 'forgot' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [dismissedUrlError, setDismissedUrlError] = useState(false);

  const mode: 'login' | 'signup' | 'forgot' =
    modeOverride ?? (searchParams.get('mode') === 'signup' ? 'signup' : 'login');

  const urlError =
    !dismissedUrlError && errorParam ? errorParam.replace(/\+/g, ' ') : null;
  const message = actionMessage ?? urlError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDismissedUrlError(true);
    setActionMessage(null);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setActionMessage(error.message);
      else setActionMessage('Check your email to confirm your account.');
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) setActionMessage(error.message);
      else setActionMessage('Check your email for a link to reset your password.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setActionMessage(error.message);
      else window.location.href = redirectTo;
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[#ffb020]/35 bg-[#060a14]/85 px-4 py-3.5 text-base text-white placeholder:text-slate-500 shadow-[inset_0_0_0_1px_rgba(255,176,32,0.06)] transition focus:border-[#ffb020]/80 focus:outline-none focus:ring-2 focus:ring-[#ffb020]/35';

  return (
    <main
      className={`${outfit.className} relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#010205] px-4 py-10 text-white antialiased`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to bottom, #050816 0%, #010205 45%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -10%, rgba(30,55,100,0.45) 0%, transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 20% 15%, rgba(90,60,140,0.12) 0%, transparent 50%), radial-gradient(ellipse 55% 40% at 85% 25%, rgba(40,80,160,0.1) 0%, transparent 48%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-56 w-[min(100%,720px)] -translate-x-1/2 rounded-[100%] blur-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,110,35,0.22) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/landing"
          className="mb-8 flex justify-center no-touch-target opacity-90 transition hover:opacity-100"
        >
          <div className="relative h-24 w-40 sm:h-28 sm:w-44">
            <Image
              src={LOGO_SRC}
              alt="Level Up Solutions"
              fill
              unoptimized
              className="object-contain object-center"
              sizes="176px"
            />
          </div>
        </Link>

        <div
          className="rounded-xl border-2 border-[#ffb020]/75 bg-black/40 px-6 py-8 backdrop-blur-sm sm:px-8"
          style={{
            boxShadow:
              '0 0 24px rgba(255, 160, 40, 0.3), 0 0 1px rgba(255, 200, 100, 0.4), inset 0 0 40px rgba(255, 160, 40, 0.07)',
          }}
        >
          <h1
            className="mb-6 text-center text-xl font-bold tracking-tight text-[#ffe066] sm:text-2xl"
            style={{
              textShadow: '0 0 20px rgba(255,200,80,0.45), 0 0 40px rgba(255,150,40,0.2)',
            }}
          >
            {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create an account' : 'Reset password'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className={inputClass}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {mode !== 'forgot' && (
              <input
                className={inputClass}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            )}
            {mode === 'login' && (
              <button
                type="button"
                className="w-full py-1 text-left text-sm text-[#ffb86b] underline decoration-[#ffb020]/40 underline-offset-2 transition hover:text-[#ffc84a]"
                onClick={() => {
                  setModeOverride('forgot');
                  setDismissedUrlError(true);
                  setActionMessage(null);
                }}
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              className="no-touch-target w-full rounded-xl border-2 border-[#ffb020] bg-[#ffb020]/15 px-4 py-3.5 text-base font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(255,160,40,0.45),inset_0_0_20px_rgba(255,160,40,0.08)] backdrop-blur-[2px] transition hover:bg-[#ffb020]/25 active:opacity-95"
            >
              {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
            </button>
          </form>

          {message && (
            <p
              className={`mt-4 px-2 text-center text-sm ${
                (mode === 'forgot' || mode === 'signup') && message.includes('Check your email')
                  ? 'text-[#ffc84a]'
                  : 'text-red-400'
              }`}
            >
              {message}
            </p>
          )}

          <div className="mt-6 border-t border-[#ffb020]/20 pt-6">
            <button
              type="button"
              className="w-full py-2 text-sm text-slate-300 transition hover:text-[#ffc84a] active:opacity-80 sm:text-xs"
              onClick={() => {
                if (mode === 'forgot') setModeOverride('login');
                else if (mode === 'login') setModeOverride('signup');
                else setModeOverride('login');
                setDismissedUrlError(true);
                setActionMessage(null);
              }}
            >
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <span className="font-semibold text-[#ffb86b] underline decoration-[#ffb020]/50 underline-offset-2">
                    Sign up
                  </span>
                </>
              ) : mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <span className="font-semibold text-[#ffb86b] underline decoration-[#ffb020]/50 underline-offset-2">
                    Log in
                  </span>
                </>
              ) : (
                <span className="font-semibold text-[#ffb86b] underline decoration-[#ffb020]/50 underline-offset-2">
                  Back to log in
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
