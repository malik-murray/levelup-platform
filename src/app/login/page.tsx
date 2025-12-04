'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@auth/supabaseClient';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) setMessage(error.message);
            else setMessage('Check your email to confirm your account.');
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setMessage(error.message);
            else window.location.href = '/dashboard';
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4 py-8">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
                <h1 className="mb-6 text-xl sm:text-2xl font-semibold text-center">
                    {mode === 'login' ? 'Log in' : 'Create an account'}
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
                    <input
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />

                    <button
                        type="submit"
                        className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-semibold text-black hover:bg-emerald-400 active:bg-emerald-600 transition-colors"
                    >
                        {mode === 'login' ? 'Log in' : 'Sign up'}
                    </button>
                </form>

                {message && (
                    <p className="mt-4 text-center text-sm text-red-400 px-2">
                        {message}
                    </p>
                )}

                <button
                    className="mt-6 w-full text-sm sm:text-xs text-slate-300 underline py-2 active:opacity-70"
                    onClick={() =>
                        setMode(prev => (prev === 'login' ? 'signup' : 'login'))
                    }
                >
                    {mode === 'login'
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Log in'}
                </button>
            </div>
        </main>
    );
}
