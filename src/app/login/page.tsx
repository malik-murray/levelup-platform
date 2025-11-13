'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
                <h1 className="mb-6 text-2xl font-semibold text-center">
                    {mode === 'login' ? 'Log in' : 'Create an account'}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />

                    <button
                        type="submit"
                        className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                    >
                        {mode === 'login' ? 'Log in' : 'Sign up'}
                    </button>
                </form>

                {message && (
                    <p className="mt-4 text-center text-sm text-red-400">
                        {message}
                    </p>
                )}

                <button
                    className="mt-6 w-full text-xs text-slate-300 underline"
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
