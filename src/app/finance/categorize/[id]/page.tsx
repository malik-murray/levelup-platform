'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { learnMerchantMappingFromUserCategory } from '@/lib/financial-concierge/categoryEngine';

type Category = {
    id: string;
    name: string;
    kind: string;
    type: string | null;
};

type TxRow = {
    id: string;
    amount: number;
    name: string | null;
    note: string | null;
    date: string;
    pending: boolean;
    category_id: string | null;
};

function formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Math.abs(amount));
}

export default function QuickCategorizePage() {
    const params = useParams();
    const router = useRouter();
    const transactionId = typeof params.id === 'string' ? params.id : '';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tx, setTx] = useState<TxRow | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!transactionId) {
                setLoading(false);
                return;
            }

            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = `/login?next=${encodeURIComponent(`/finance/categorize/${transactionId}`)}`;
                return;
            }

            const [txRes, catRes] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('id, amount, name, note, date, pending, category_id')
                    .eq('id', transactionId)
                    .eq('user_id', user.id)
                    .maybeSingle(),
                supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .eq('user_id', user.id)
                    .eq('is_archived', false)
                    .order('name'),
            ]);

            if (txRes.error || !txRes.data) {
                setMessage('Transaction not found.');
                setLoading(false);
                return;
            }

            setTx(txRes.data as TxRow);
            setSelectedId(txRes.data.category_id);
            setCategories((catRes.data as Category[]) ?? []);
            setLoading(false);
        };

        void load();
    }, [transactionId]);

    const expenseCategories = useMemo(() => {
        const isExpense = (tx?.amount ?? 0) < 0;
        return categories.filter(
            c =>
                c.kind === 'category' &&
                (isExpense ? c.type === 'expense' : c.type === 'income')
        );
    }, [categories, tx?.amount]);

    const suggestedCategory = useMemo(
        () => expenseCategories.find(c => c.id === tx?.category_id) ?? null,
        [expenseCategories, tx?.category_id]
    );

    const sortedCategories = useMemo(() => {
        const rest = expenseCategories.filter(c => c.id !== suggestedCategory?.id);
        return suggestedCategory ? [suggestedCategory, ...rest] : rest;
    }, [expenseCategories, suggestedCategory]);

    const merchantLabel = useMemo(() => {
        if (!tx) return '';
        return (tx.note || tx.name || 'Transaction').trim();
    }, [tx]);

    const saveCategory = useCallback(
        async (categoryId: string) => {
            if (!tx || saving) return;
            setSaving(true);
            setMessage(null);

            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('transactions')
                .update({
                    category_id: categoryId,
                    categorization_method: 'user_override',
                })
                .eq('id', tx.id)
                .eq('user_id', user.id);

            if (error) {
                setMessage('Could not save. Try again.');
                setSaving(false);
                return;
            }

            void learnMerchantMappingFromUserCategory(supabase, {
                userId: user.id,
                categoryId,
                name: tx.name,
                note: tx.note,
            });

            setSelectedId(categoryId);
            setDone(true);
            setMessage('Saved!');
            setSaving(false);
        },
        [tx, saving]
    );

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-6">
                <p className="text-sm text-slate-400">Loading…</p>
            </div>
        );
    }

    if (!tx) {
        return (
            <div className="p-6 text-center">
                <p className="text-amber-200">{message || 'Transaction not found.'}</p>
                <Link href="/finance/transactions" className="mt-4 inline-block text-sm text-violet-300 underline">
                    All transactions
                </Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-2xl font-semibold text-emerald-300">Categorized</p>
                <p className="text-sm text-slate-400">
                    {merchantLabel} · {formatMoney(tx.amount)}
                </p>
                <button
                    type="button"
                    onClick={() => router.push('/finance/transactions')}
                    className="mt-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-6">
            <div className="mb-4 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-sm text-slate-400"
                >
                    ← Back
                </button>
                {tx.pending ? (
                    <span className="rounded-full bg-amber-900/80 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        Pending
                    </span>
                ) : null}
            </div>

            <p className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                On iPhone, Apple only allows <strong className="text-slate-300">tap notification → pick here</strong>.
                Category buttons in the notification tray are not supported for web apps.
            </p>

            <h1 className="mt-4 text-lg font-semibold text-white">Categorize purchase</h1>
            <p className="mt-1 text-2xl font-bold text-violet-200">{formatMoney(tx.amount)}</p>
            <p className="mt-1 text-base text-slate-300">{merchantLabel}</p>
            <p className="text-xs text-slate-500">{tx.date}</p>

            {suggestedCategory ? (
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveCategory(suggestedCategory.id)}
                    className="mt-5 w-full rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/50 px-4 py-4 text-left transition active:scale-[0.98]"
                >
                    <span className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">
                        Suggested · one tap
                    </span>
                    <span className="mt-1 block text-xl font-bold text-white">{suggestedCategory.name}</span>
                </button>
            ) : null}

            <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">
                {suggestedCategory ? 'Or choose another' : 'Pick a category'}
            </p>

            <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto content-start pb-4">
                {(suggestedCategory ? sortedCategories.slice(1) : sortedCategories).map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        disabled={saving}
                        onClick={() => void saveCategory(cat.id)}
                        className="min-h-[52px] rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-left text-sm font-semibold leading-tight text-slate-100 transition active:scale-[0.98] active:border-violet-500"
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {message ? <p className="mt-3 text-center text-sm text-amber-200">{message}</p> : null}

            <Link
                href="/finance/transactions"
                className="mt-4 block text-center text-sm text-slate-500 underline"
            >
                Skip for now
            </Link>
        </div>
    );
}
