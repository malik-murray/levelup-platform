'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';

type Transaction = {
    id: string;
    amount: number;
    date: string;
};

type Budget = {
    category_id: string;
    amount: number;
};

export default function FinanceWidget({
    selectedDate,
    userId,
}: {
    selectedDate: Date;
    userId: string | null;
}) {
    const [todaySpending, setTodaySpending] = useState(0);
    const [monthSpending, setMonthSpending] = useState(0);
    const [monthBudget, setMonthBudget] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [selectedDate, userId]);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);
            const monthStr = dateStr.substring(0, 7); // YYYY-MM

            // Load today's transactions (expenses only)
            const { data: todayTx } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .lt('amount', 0);

            // Load month's transactions (expenses only)
            const { data: monthTx } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .gte('date', `${monthStr}-01`)
                .lt('date', `${monthStr}-32`)
                .lt('amount', 0);

            // Load month's budget
            const { data: budgets } = await supabase
                .from('category_budgets')
                .select('amount')
                .eq('user_id', userId)
                .eq('month', monthStr);

            const todayTotal = Math.abs(todayTx?.reduce((sum, tx) => sum + tx.amount, 0) || 0);
            const monthTotal = Math.abs(monthTx?.reduce((sum, tx) => sum + tx.amount, 0) || 0);
            const budgetTotal = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;

            setTodaySpending(todayTotal);
            setMonthSpending(monthTotal);
            setMonthBudget(budgetTotal);
        } catch (error) {
            console.error('Error loading finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
            </div>
        );
    }

    const budgetRemaining = monthBudget - monthSpending;
    const budgetPercentage = monthBudget > 0 ? (monthSpending / monthBudget) * 100 : 0;

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Link href="/finance" className="hover:underline">
                    <h3 className="text-lg font-semibold">Finance</h3>
                </Link>
            </div>

            <div className="space-y-2 text-sm">
                <div>
                    <div className="text-slate-400">Today's Spending</div>
                    <div className="text-white font-semibold">${todaySpending.toFixed(2)}</div>
                </div>

                <div>
                    <div className="text-slate-400">Month Spending</div>
                    <div className="text-white font-semibold">${monthSpending.toFixed(2)}</div>
                </div>

                {monthBudget > 0 && (
                    <>
                        <div>
                            <div className="text-slate-400">Budget Remaining</div>
                            <div className={`font-semibold ${budgetRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${budgetRemaining.toFixed(2)}
                            </div>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${
                                    budgetPercentage > 100 ? 'bg-red-500' : budgetPercentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                            />
                        </div>
                        <div className="text-xs text-slate-500">
                            {budgetPercentage.toFixed(1)}% of budget used
                        </div>
                    </>
                )}
            </div>

            <div className="pt-2 border-t border-slate-700">
                <Link
                    href="/finance"
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                    View full Finance Tracker →
                </Link>
            </div>
        </div>
    );
}
