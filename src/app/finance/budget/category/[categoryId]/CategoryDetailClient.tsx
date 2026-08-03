'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { resolveStickyBudgetAmounts, isSavingsInvestingBucket } from '@/lib/budgetOverview';

type Category = {
    id: string;
    name: string;
    kind: 'group' | 'category';
    type: 'income' | 'expense' | 'transfer' | null;
    parent_id: string | null;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    name: string | null;
    note: string | null;
    person: string | null;
    account_name: string | null;
    is_transfer: boolean;
    pending: boolean;
};

function formatMoney(n: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(n);
}

function monthBounds(monthStr: string): { start: string; end: string } {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
    };
}

export default function BudgetCategoryDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const categoryId = typeof params.categoryId === 'string' ? params.categoryId : '';

    const monthStr = useMemo(() => {
        const q = searchParams.get('month');
        if (q && /^\d{4}-\d{2}$/.test(q)) return q;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, [searchParams]);

    const monthLabel = useMemo(() => {
        const [y, m] = monthStr.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric',
        });
    }, [monthStr]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [category, setCategory] = useState<Category | null>(null);
    const [parentName, setParentName] = useState<string | null>(null);
    const [assigned, setAssigned] = useState(0);
    const [transactions, setTransactions] = useState<TxRow[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!categoryId) {
                setError('Missing category.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = `/login?next=${encodeURIComponent(
                    `/finance/budget/category/${categoryId}?month=${monthStr}`
                )}`;
                return;
            }

            const { start, end } = monthBounds(monthStr);

            const [catRes, budgetRes, txRes] = await Promise.all([
                supabase
                    .from('categories')
                    .select('id, name, kind, type, parent_id')
                    .eq('id', categoryId)
                    .eq('user_id', user.id)
                    .maybeSingle(),
                supabase
                    .from('category_budgets')
                    .select('category_id, month, amount')
                    .eq('user_id', user.id)
                    .eq('category_id', categoryId),
                supabase
                    .from('transactions')
                    .select(
                        `
                        id, date, amount, name, note, person, is_transfer, pending,
                        accounts ( name )
                    `
                    )
                    .eq('user_id', user.id)
                    .eq('category_id', categoryId)
                    .gte('date', start)
                    .lt('date', end)
                    .order('date', { ascending: false }),
            ]);

            if (catRes.error || !catRes.data) {
                setError('Category not found.');
                setLoading(false);
                return;
            }

            const cat = catRes.data as Category;
            setCategory(cat);

            if (cat.parent_id) {
                const { data: parent } = await supabase
                    .from('categories')
                    .select('name')
                    .eq('id', cat.parent_id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                setParentName(parent?.name ?? null);
            } else {
                setParentName(null);
            }

            const sticky = resolveStickyBudgetAmounts(budgetRes.data ?? []);
            setAssigned(Math.abs(sticky.get(categoryId) ?? 0));

            const rows: TxRow[] = (txRes.data ?? []).map((tx: any) => {
                const accounts = tx.accounts;
                const accountName = Array.isArray(accounts)
                    ? accounts[0]?.name ?? null
                    : accounts?.name ?? null;
                return {
                    id: tx.id,
                    date: tx.date,
                    amount: Number(tx.amount),
                    name: tx.name,
                    note: tx.note,
                    person: tx.person,
                    account_name: accountName,
                    is_transfer: Boolean(tx.is_transfer),
                    pending: Boolean(tx.pending),
                };
            });
            setTransactions(rows);
            setLoading(false);
        };

        load().catch((err) => {
            console.error(err);
            setError('Failed to load category details.');
            setLoading(false);
        });
    }, [categoryId, monthStr]);

    const activity = useMemo(() => {
        if (!category) return 0;
        const isSavings = isSavingsInvestingBucket(category.type, category.name);
        return transactions.reduce((sum, tx) => {
            if (isSavings || category.type === 'expense') {
                return sum + Math.abs(Math.min(0, tx.amount));
            }
            if (category.type === 'income') {
                return sum + Math.max(0, tx.amount);
            }
            return sum + Math.abs(tx.amount);
        }, 0);
    }, [transactions, category]);

    const available = assigned - activity;

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <Link
                        href="/finance/budget"
                        className="text-[11px] text-slate-400 hover:text-amber-400"
                    >
                        ← Back to Financial Plan
                    </Link>
                    <h2 className="text-lg font-semibold mt-1">
                        {category?.name ?? 'Category'}
                    </h2>
                    <p className="text-xs text-slate-400">
                        {parentName ? `${parentName} · ` : ''}
                        {monthLabel}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
                    Loading…
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-xs text-red-200">
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                            <div className="text-[10px] uppercase text-slate-400">Assigned</div>
                            <div className="text-xl font-semibold text-slate-100">
                                {formatMoney(assigned)}
                            </div>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                            <div className="text-[10px] uppercase text-slate-400">Activity</div>
                            <div className="text-xl font-semibold text-slate-100">
                                {formatMoney(activity)}
                            </div>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                            <div className="text-[10px] uppercase text-slate-400">Available</div>
                            <div
                                className={`text-xl font-semibold ${
                                    available >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                            >
                                {formatMoney(available)}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">
                                Transactions ({transactions.length})
                            </h3>
                            <Link
                                href="/finance/transactions"
                                className="text-[11px] text-amber-400 hover:text-amber-300"
                            >
                                All transactions →
                            </Link>
                        </div>
                        {transactions.length === 0 ? (
                            <div className="p-4 text-xs text-slate-400">
                                No transactions in this category for {monthLabel}.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-800">
                                {transactions.map((tx) => (
                                    <li key={tx.id} className="px-4 py-3 hover:bg-slate-950/60">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm text-slate-200 truncate">
                                                    {tx.is_transfer && (
                                                        <span className="mr-1 text-blue-400">↔</span>
                                                    )}
                                                    {tx.name || tx.person || tx.note || 'Transaction'}
                                                    {tx.pending ? (
                                                        <span className="ml-2 text-[10px] text-amber-400">
                                                            pending
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {tx.date}
                                                    {tx.account_name ? ` · ${tx.account_name}` : ''}
                                                    {tx.note && tx.name ? ` · ${tx.note}` : ''}
                                                </div>
                                            </div>
                                            <div
                                                className={`text-sm font-medium tabular-nums shrink-0 ${
                                                    tx.amount < 0
                                                        ? 'text-red-300'
                                                        : 'text-emerald-300'
                                                }`}
                                            >
                                                {tx.amount < 0 ? '−' : '+'}
                                                {formatMoney(Math.abs(tx.amount))}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
