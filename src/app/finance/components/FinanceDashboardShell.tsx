'use client';

import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useMemo, type ReactNode } from 'react';
import {
    ACCOUNT_GROUP_LABELS,
    ACCOUNT_GROUP_ORDER,
    getAccountGroupIcon,
    type AccountGroup,
} from '@/lib/finance/accountBalances';

const BG = '#0a0e14';
const CARD_BORDER = '#1e293b';
const MUTED = '#94a3b8';

const DONUT_COLORS = [
    '#6366f1',
    '#22c55e',
    '#f59e0b',
    '#ec4899',
    '#3b82f6',
    '#a855f7',
    '#14b8a6',
    '#eab308',
];

function formatUsd(n: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

function formatUsdFull(n: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(n);
}

function pctChange(current: number, previous: number): { text: string; up: boolean | null } {
    if (previous === 0 && current === 0) return { text: '— vs last month', up: null };
    if (previous === 0) return { text: '↑ new vs last month', up: true };
    const raw = ((current - previous) / Math.abs(previous)) * 100;
    const up = raw >= 0;
    return {
        text: `${up ? '↑' : '↓'} ${Math.abs(Math.round(raw))}% vs last month`,
        up,
    };
}

type SparkProps = {
    data: number[];
    color: string;
    id: string;
};

function MiniSpark({ data, color, id }: SparkProps) {
    const pts = useMemo(
        () => data.map((v, i) => ({ i, v: Math.max(0, v) })),
        [data]
    );
    if (pts.length < 2) {
        return <div className="h-10 w-20 shrink-0 rounded bg-white/5" />;
    }
    return (
        <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="v"
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#${id})`}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

type DonutGoalProps = {
    pct: number;
    color: string;
    label: string;
    sub: string;
    status: string;
};

function DonutGoal({ pct, color, label, sub, status }: DonutGoalProps) {
    const data = [
        { name: 'done', value: Math.min(100, Math.max(0, pct)) },
        { name: 'rest', value: Math.max(0, 100 - Math.min(100, pct)) },
    ];
    return (
        <div className="flex flex-col items-center text-center">
            <div className="relative h-28 w-28">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            innerRadius={32}
                            outerRadius={44}
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            <Cell fill={color} />
                            <Cell fill="#1e293b" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-white">{Math.round(pct)}%</span>
                </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{label}</p>
            <p className="mt-0.5 max-w-[10rem] text-[11px] text-slate-400">{sub}</p>
            <p className="mt-1 text-[11px] font-medium" style={{ color }}>
                {status}
            </p>
        </div>
    );
}

export type SpendingSlice = { name: string; value: number; color: string };
export type BudgetRow = { name: string; spent: number; budget: number; color: string };
export type CashMonth = { label: string; income: number; expenses: number; net: number };
export type AccountRow = {
    id: string;
    name: string;
    type: string;
    group: AccountGroup;
    balance: number;
    signedBalance: number;
    changePct: number | null;
};
export type IncomeStreamRow = { name: string; thisMonth: number; lastMonth: number; goalPct: number };
export type TxRow = {
    id: string;
    merchant: string;
    date: string;
    amount: number;
    category?: string;
};

export type FinanceDashboardShellProps = {
    dateRangeLabel: string;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    expenseRatioPct: number;
    netWorth: number;
    prevIncome: number;
    prevExpenses: number;
    prevNet: number;
    prevExpenseRatioPct: number;
    prevNetWorth: number;
    incomeSpark: number[];
    expenseSpark: number[];
    ratioSpark: number[];
    netWorthSpark: number[];
    spendingSlices: SpendingSlice[];
    budgetRows: BudgetRow[];
    cashMonths: CashMonth[];
    accountRows: AccountRow[];
    incomeStreams: IncomeStreamRow[];
    recentTx: TxRow[];
    savingsTotal: number;
    emergencyGoal: number;
    investRatePct: number;
};

function Card({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-xl border p-4 sm:p-5 ${className}`}
            style={{ borderColor: CARD_BORDER, backgroundColor: '#0f1419' }}
        >
            {children}
        </div>
    );
}

export function FinanceDashboardShell({
    dateRangeLabel,
    totalIncome,
    totalExpenses,
    netIncome,
    expenseRatioPct,
    netWorth,
    prevIncome,
    prevExpenses,
    prevNet,
    prevExpenseRatioPct,
    prevNetWorth,
    incomeSpark,
    expenseSpark,
    ratioSpark,
    netWorthSpark,
    spendingSlices,
    budgetRows,
    cashMonths,
    accountRows,
    incomeStreams,
    recentTx,
    savingsTotal,
    emergencyGoal,
    investRatePct,
}: FinanceDashboardShellProps) {
    const donutData = spendingSlices.map(s => ({ name: s.name, value: s.value, color: s.color }));
    const totalSpend = donutData.reduce((a, b) => a + b.value, 0) || 1;

    const netIncDelta = pctChange(netIncome, prevNet);
    const expDelta = pctChange(totalExpenses, prevExpenses);
    const ratioDelta = pctChange(expenseRatioPct, prevExpenseRatioPct);
    const nwDelta = pctChange(netWorth, prevNetWorth);

    const cashSummary = useMemo(() => {
        const last = cashMonths[cashMonths.length - 1];
        if (!last) return { income: 0, expenses: 0, net: 0 };
        return { income: last.income, expenses: last.expenses, net: last.net };
    }, [cashMonths]);

    const accountsByGroup = useMemo(() => {
        return ACCOUNT_GROUP_ORDER.map(group => ({
            group,
            label: ACCOUNT_GROUP_LABELS[group],
            accounts: accountRows.filter(a => a.group === group),
            subtotal: accountRows
                .filter(a => a.group === group)
                .reduce((s, a) => s + a.balance, 0),
        })).filter(g => g.accounts.length > 0);
    }, [accountRows]);

    const accountsNetTotal = useMemo(
        () => accountRows.reduce((s, a) => s + a.signedBalance, 0),
        [accountRows]
    );

    return (
        <div className="space-y-5 font-sans text-slate-200" style={{ backgroundColor: BG }}>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Finances</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Take control of your money. Build wealth. Create freedom.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className="rounded-full border px-4 py-2 text-xs font-medium text-slate-300"
                        style={{ borderColor: CARD_BORDER, backgroundColor: '#0f1419' }}
                    >
                        {dateRangeLabel}
                    </div>
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold text-[#ffe066]"
                        style={{ borderColor: '#ff9d00', backgroundColor: 'rgba(255,157,0,0.15)' }}
                        aria-hidden
                    >
                        LU
                    </div>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="flex flex-col justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Net Income</p>
                    <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold text-emerald-400">{formatUsd(netIncome)}</p>
                        <MiniSpark data={incomeSpark} color="#34d399" id="spark-inc" />
                    </div>
                    <p
                        className={`mt-2 text-[11px] ${
                            netIncDelta.up === true
                                ? 'text-emerald-400'
                                : netIncDelta.up === false
                                  ? 'text-red-400'
                                  : 'text-slate-500'
                        }`}
                    >
                        {netIncDelta.text}
                    </p>
                </Card>
                <Card className="flex flex-col justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expenses</p>
                    <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold text-red-400">{formatUsd(totalExpenses)}</p>
                        <MiniSpark data={expenseSpark} color="#f87171" id="spark-exp" />
                    </div>
                    <p
                        className={`mt-2 text-[11px] ${
                            expDelta.up === true
                                ? 'text-red-400'
                                : expDelta.up === false
                                  ? 'text-emerald-400'
                                  : 'text-slate-500'
                        }`}
                    >
                        {expDelta.text}
                    </p>
                </Card>
                <Card className="flex flex-col justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expense Ratio</p>
                    <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold text-white">{Math.round(expenseRatioPct)}%</p>
                        <div className="h-10 w-24 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { v: Math.min(expenseRatioPct, 100) },
                                            { v: Math.max(0, 100 - expenseRatioPct) },
                                        ]}
                                        dataKey="v"
                                        innerRadius={14}
                                        outerRadius={22}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        <Cell fill="#34d399" />
                                        <Cell fill="#1e293b" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <p
                        className={`mt-2 text-[11px] ${
                            ratioDelta.up === false ? 'text-emerald-400' : ratioDelta.up === true ? 'text-red-400' : 'text-slate-500'
                        }`}
                    >
                        {ratioDelta.text}
                    </p>
                </Card>
                <Card className="flex flex-col justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Net Worth</p>
                    <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold text-sky-400">{formatUsd(netWorth)}</p>
                        <MiniSpark data={netWorthSpark} color="#38bdf8" id="spark-nw" />
                    </div>
                    <p
                        className={`mt-2 text-[11px] ${
                            nwDelta.up === true
                                ? 'text-sky-400'
                                : nwDelta.up === false
                                  ? 'text-red-400'
                                  : 'text-slate-500'
                        }`}
                    >
                        {nwDelta.text}
                    </p>
                </Card>
            </div>

            {/* Spending + Budget */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <h2 className="text-sm font-semibold text-white">Spending overview</h2>
                    <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center">
                        <div className="relative mx-auto h-52 w-52 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        dataKey="value"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={58}
                                        outerRadius={82}
                                        paddingAngle={2}
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        {donutData.map((e, i) => (
                                            <Cell key={e.name} fill={e.color || DONUT_COLORS[i % DONUT_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={v => formatUsdFull(Number(v ?? 0))}
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: `1px solid ${CARD_BORDER}`,
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-white">{formatUsd(totalSpend)}</span>
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Total</span>
                            </div>
                        </div>
                        <ul className="min-w-0 flex-1 space-y-2.5">
                            {donutData.length === 0 ? (
                                <li className="text-sm text-slate-500">No expense categories this period.</li>
                            ) : (
                                donutData.map((row, i) => {
                                    const pct = Math.round((row.value / totalSpend) * 100);
                                    return (
                                        <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            row.color || DONUT_COLORS[i % DONUT_COLORS.length],
                                                    }}
                                                />
                                                <span className="truncate text-slate-300">{row.name}</span>
                                            </span>
                                            <span className="shrink-0 text-slate-400">
                                                {formatUsd(row.value)}{' '}
                                                <span className="text-slate-500">({pct}%)</span>
                                            </span>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>
                </Card>
                <Card>
                    <h2 className="text-sm font-semibold text-white">Budget progress</h2>
                    <ul className="mt-4 space-y-4">
                        {budgetRows.length === 0 ? (
                            <li className="text-sm text-slate-500">Set budgets on the Budget page to track progress.</li>
                        ) : (
                            budgetRows.map(row => {
                                const pct = row.budget > 0 ? Math.min(100, (row.spent / row.budget) * 100) : 0;
                                return (
                                    <li key={row.name}>
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="truncate font-medium text-slate-200">{row.name}</span>
                                            <span className="shrink-0 text-xs text-slate-400">
                                                {formatUsdFull(row.spent)} / {formatUsdFull(row.budget)}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: row.color,
                                                }}
                                            />
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-500">{Math.round(pct)}% used</p>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </Card>
            </div>

            {/* Cash flow + Accounts */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <h2 className="text-sm font-semibold text-white">Cash flow</h2>
                    <div className="mt-4 flex flex-col gap-4 lg:flex-row">
                        <div className="min-h-[220px] flex-1 min-w-0">
                            {cashMonths.length === 0 ? (
                                <p className="text-sm text-slate-500">No data for this range.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <ComposedChart data={cashMonths} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            tick={{ fill: MUTED, fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                                        />
                                        <Tooltip
                                            formatter={v => formatUsdFull(Number(v ?? 0))}
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: `1px solid ${CARD_BORDER}`,
                                                borderRadius: 8,
                                                fontSize: 12,
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                        <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                        <Line type="monotone" dataKey="net" name="Net" stroke="#f8fafc" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div
                            className="flex w-full shrink-0 flex-col justify-center gap-3 rounded-lg border p-4 lg:w-44"
                            style={{ borderColor: CARD_BORDER, backgroundColor: '#0a0e14' }}
                        >
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Income</p>
                                <p className="text-lg font-semibold text-emerald-400">{formatUsd(cashSummary.income)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Expenses</p>
                                <p className="text-lg font-semibold text-red-400">{formatUsd(cashSummary.expenses)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Net</p>
                                <p
                                    className={`text-lg font-semibold ${
                                        cashSummary.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}
                                >
                                    {formatUsd(cashSummary.net)}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-baseline justify-between gap-2">
                        <h2 className="text-sm font-semibold text-white">Accounts</h2>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-sky-400">{formatUsd(accountsNetTotal)}</p>
                    <p className="text-[11px] text-slate-500">Net across accounts</p>
                    <div className="mt-4 space-y-5">
                        {accountRows.length === 0 ? (
                            <p className="text-sm text-slate-500">Add accounts to see balances.</p>
                        ) : (
                            accountsByGroup.map(({ group, label, accounts, subtotal }) => (
                                <div key={group}>
                                    <div className="mb-2 flex items-baseline justify-between gap-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                            {label}
                                        </p>
                                        <p
                                            className={`text-[11px] font-medium ${
                                                group === 'credit'
                                                    ? subtotal < 0
                                                        ? 'text-red-400'
                                                        : 'text-slate-400'
                                                    : 'text-slate-300'
                                            }`}
                                        >
                                            {formatUsd(subtotal)}
                                        </p>
                                    </div>
                                    <ul className="space-y-3">
                                        {accounts.map(acc => (
                                            <li
                                                key={acc.id}
                                                className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3 last:border-0 last:pb-0"
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg">
                                                        {getAccountGroupIcon(group)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-white">
                                                            {acc.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 capitalize">
                                                            {acc.type}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p
                                                        className={`text-sm font-semibold ${
                                                            group === 'credit'
                                                                ? acc.balance < 0
                                                                    ? 'text-red-400'
                                                                    : 'text-slate-400'
                                                                : 'text-white'
                                                        }`}
                                                    >
                                                        {formatUsdFull(acc.balance)}
                                                    </p>
                                                    {acc.changePct != null && (
                                                        <p
                                                            className={`text-[11px] ${
                                                                acc.changePct >= 0
                                                                    ? 'text-emerald-400'
                                                                    : 'text-red-400'
                                                            }`}
                                                        >
                                                            {acc.changePct >= 0 ? '+' : ''}
                                                            {acc.changePct.toFixed(1)}%
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Income streams + Transactions */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="overflow-x-auto">
                    <h2 className="text-sm font-semibold text-white">Income streams</h2>
                    <table className="mt-4 w-full min-w-[320px] text-left text-xs">
                        <thead>
                            <tr className="border-b text-slate-500" style={{ borderColor: CARD_BORDER }}>
                                <th className="pb-2 font-medium">Stream</th>
                                <th className="pb-2 font-medium">This month</th>
                                <th className="pb-2 font-medium">vs last</th>
                                <th className="pb-2 font-medium">Goal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incomeStreams.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-4 text-slate-500">
                                        No income categories this month.
                                    </td>
                                </tr>
                            ) : (
                                incomeStreams.map(row => {
                                    const vs =
                                        row.lastMonth > 0
                                            ? Math.round(((row.thisMonth - row.lastMonth) / row.lastMonth) * 100)
                                            : row.thisMonth > 0
                                              ? 100
                                              : 0;
                                    return (
                                        <tr key={row.name} className="border-b border-slate-800/80">
                                            <td className="py-2.5 font-medium text-slate-200">{row.name}</td>
                                            <td className="py-2.5 text-emerald-400">{formatUsdFull(row.thisMonth)}</td>
                                            <td className="py-2.5">
                                                <span className="text-emerald-400">↑ {vs}%</span>
                                            </td>
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                                                        <div
                                                            className="h-full rounded-full bg-emerald-500"
                                                            style={{ width: `${Math.min(100, row.goalPct)}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-8 text-right text-slate-400">{Math.round(row.goalPct)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </Card>
                <Card>
                    <h2 className="text-sm font-semibold text-white">Recent transactions</h2>
                    <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {recentTx.length === 0 ? (
                            <li className="text-sm text-slate-500">No transactions this month.</li>
                        ) : (
                            recentTx.map(tx => (
                                <li
                                    key={tx.id}
                                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                                    style={{ borderColor: '#1e293b80' }}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-300">
                                            {tx.merchant.slice(0, 1).toUpperCase()}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">{tx.merchant}</p>
                                            <p className="text-[11px] text-slate-500">
                                                {tx.date}
                                                {tx.category ? ` · ${tx.category}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`shrink-0 text-sm font-semibold ${
                                            tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                    >
                                        {tx.amount >= 0 ? '+' : ''}
                                        {formatUsdFull(tx.amount)}
                                    </span>
                                </li>
                            ))
                        )}
                    </ul>
                </Card>
            </div>

            {/* Goals */}
            <Card>
                <h2 className="text-sm font-semibold text-white">Financial goals</h2>
                <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
                    <DonutGoal
                        pct={Math.min(expenseRatioPct, 100)}
                        color="#34d399"
                        label="Expense ratio"
                        sub="Target ≤ 50% of income"
                        status={expenseRatioPct <= 50 ? 'On track' : 'Over target'}
                    />
                    <DonutGoal
                        pct={emergencyGoal > 0 ? Math.min(100, (savingsTotal / emergencyGoal) * 100) : 0}
                        color="#38bdf8"
                        label="Emergency fund"
                        sub={`Target ${formatUsdFull(emergencyGoal)}`}
                        status={`${formatUsd(savingsTotal)} saved`}
                    />
                    <DonutGoal
                        pct={Math.min(investRatePct, 100)}
                        color="#fbbf24"
                        label="Invest 1–5% of income"
                        sub="Target 5% of income"
                        status={investRatePct >= 5 ? 'On track' : 'Room to grow'}
                    />
                </div>
            </Card>

            {/* Footer strip + banner */}
            <div
                className="grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-5"
                style={{ borderColor: CARD_BORDER, backgroundColor: '#0f1419' }}
            >
                {[
                    { label: 'Total income', value: formatUsd(totalIncome), sub: netIncDelta.text },
                    { label: 'Total expenses', value: formatUsd(totalExpenses), sub: expDelta.text },
                    { label: 'Net cashflow', value: formatUsd(netIncome), sub: 'This period' },
                    { label: 'Savings', value: formatUsd(savingsTotal), sub: 'Liquid savings' },
                    { label: 'Net worth', value: formatUsd(netWorth), sub: nwDelta.text },
                ].map(m => (
                    <div key={m.label} className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-white">{m.value}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{m.sub}</p>
                    </div>
                ))}
            </div>

            <div
                className="flex flex-col gap-3 rounded-xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                style={{ background: 'linear-gradient(90deg, #7a4a00 0%, #b46e00 50%, #ff9d00 100%)' }}
            >
                <p className="flex items-start gap-2 text-sm text-amber-50">
                    <span className="mt-0.5 text-lg" aria-hidden>
                        💡
                    </span>
                    <span>
                        <span className="font-semibold text-white">Tip:</span> Review your expenses every week and invest in your future
                        self.
                    </span>
                </p>
                <p className="text-right text-sm font-medium italic text-amber-100 sm:max-w-xs">
                    Financial discipline today = Freedom tomorrow.
                </p>
            </div>
        </div>
    );
}
