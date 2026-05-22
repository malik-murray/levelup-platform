'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { supabase } from '@auth/supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryType = 'income' | 'expense' | 'transfer' | string | null;

type CategoryRow = {
    id: string;
    name: string;
    kind: 'group' | 'category';
    parent_id: string | null;
    type: CategoryType;
};

type RawTxRow = {
    id: string;
    date: string;
    amount: number | string;
    name: string | null;
    note: string | null;
    category_id: string | null;
    is_transfer: boolean | null;
};

type Tx = {
    id: string;
    date: string;        // YYYY-MM-DD
    amount: number;      // negative = outflow, positive = inflow
    name: string | null;
    note: string | null;
    categoryId: string | null;
    isTransfer: boolean;
};

type RangePreset =
    | '1w'
    | '1m'
    | '3m'
    | '6m'
    | '12m'
    | 'ytd'
    | 'all'
    | 'custom';

type Direction = 'expense' | 'income';
type GroupBy = 'group' | 'category';

type BucketRow = {
    id: string;            // category or group id (or "uncategorized")
    name: string;
    type: CategoryType;
    total: number;         // positive number (spending or income)
    txCount: number;
    color: string;
};

type MonthlyBucketRow = {
    month: string;         // YYYY-MM
    label: string;         // "Nov 2025"
    total: number;
    [bucketId: string]: number | string;
};

type CashflowMonthRow = {
    month: string;         // YYYY-MM
    label: string;         // "Nov 2025"
    income: number;        // positive
    expenses: number;      // positive
    net: number;           // can be negative
};

// ---------------------------------------------------------------------------
// Color palette (vibrant, distinguishable on dark backgrounds)
// ---------------------------------------------------------------------------

const PALETTE = [
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#ef4444', // red
    '#14b8a6', // teal
    '#eab308', // yellow
    '#6366f1', // indigo
    '#22c55e', // green
    '#f97316', // orange
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#d946ef', // fuchsia
    '#0ea5e9', // sky
    '#f43f5e', // rose
];

function colorFor(index: number): string {
    return PALETTE[index % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const moneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
});

const compactMoneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
});

function toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
    const [y, m] = key.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, 1);
    return dt.toLocaleString('default', { month: 'short', year: '2-digit' });
}

function computeRange(
    preset: RangePreset,
    customStart: string | null,
    customEnd: string | null,
): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = startOfDay(now);
    const endExclusive = addDays(today, 1); // include today

    if (preset === 'custom' && customStart && customEnd) {
        const s = new Date(customStart + 'T00:00:00');
        const e = addDays(new Date(customEnd + 'T00:00:00'), 1);
        return { startDate: s, endDate: e };
    }

    if (preset === 'all') {
        return {
            startDate: new Date(2000, 0, 1),
            endDate: endExclusive,
        };
    }

    if (preset === 'ytd') {
        return {
            startDate: new Date(now.getFullYear(), 0, 1),
            endDate: endExclusive,
        };
    }

    if (preset === '1w') {
        return {
            startDate: addDays(today, -6),
            endDate: endExclusive,
        };
    }

    const monthsBack =
        preset === '1m' ? 1
            : preset === '3m' ? 3
                : preset === '6m' ? 6
                    : 12;

    return {
        startDate: addMonths(today, -monthsBack),
        endDate: endExclusive,
    };
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

const cardClass =
    'rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs';

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                active
                    ? 'border-amber-500 bg-amber-400 text-black'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
            }`}
        >
            {children}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    const [transactions, setTransactions] = useState<Tx[]>([]);
    const [categories, setCategories] = useState<CategoryRow[]>([]);

    // Filters
    const [preset, setPreset] = useState<RangePreset>('3m');
    const [customStart, setCustomStart] = useState<string | null>(null);
    const [customEnd, setCustomEnd] = useState<string | null>(null);
    const [direction, setDirection] = useState<Direction>('expense');
    const [groupBy, setGroupBy] = useState<GroupBy>('group');
    const [includeTransfers, setIncludeTransfers] = useState(false);
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const [txListSort, setTxListSort] = useState<'date_desc' | 'amount_desc' | 'amount_asc'>(
        'date_desc',
    );

    const { startDate, endDate } = useMemo(
        () => computeRange(preset, customStart, customEnd),
        [preset, customStart, customEnd],
    );

    // Pretty period label
    const periodLabel = useMemo(() => {
        const inclusiveEnd = addDays(endDate, -1);
        const sameDay =
            startDate.getFullYear() === inclusiveEnd.getFullYear() &&
            startDate.getMonth() === inclusiveEnd.getMonth() &&
            startDate.getDate() === inclusiveEnd.getDate();
        const fmt = (d: Date) =>
            d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        return sameDay ? fmt(startDate) : `${fmt(startDate)} – ${fmt(inclusiveEnd)}`;
    }, [startDate, endDate]);

    // ----- Data load --------------------------------------------------------

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setNotification(null);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const startStr = toISODate(startDate);
            const endStr = toISODate(endDate);

            const [txResp, catResp] = await Promise.all([
                supabase
                    .from('transactions')
                    .select(
                        'id, date, amount, name, note, category_id, is_transfer',
                    )
                    .eq('user_id', user.id)
                    .is('removed_at', null)
                    .gte('date', startStr)
                    .lt('date', endStr)
                    .order('date', { ascending: true }),
                supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .eq('user_id', user.id)
                    .eq('is_archived', false),
            ]);

            if (cancelled) return;

            if (txResp.error) {
                console.error('Reports tx load error', txResp.error);
                setNotification('Error loading transactions. Check console.');
                setTransactions([]);
                setLoading(false);
                return;
            }

            if (catResp.error) {
                console.error('Reports categories load error', catResp.error);
                setNotification('Error loading categories. Check console.');
                setCategories([]);
                setLoading(false);
                return;
            }

            const txRows = ((txResp.data ?? []) as RawTxRow[]).map(r => ({
                id: r.id,
                date: r.date,
                amount: Number(r.amount),
                name: r.name,
                note: r.note,
                categoryId: r.category_id,
                isTransfer: Boolean(r.is_transfer),
            } as Tx));

            setTransactions(txRows);
            setCategories((catResp.data ?? []) as CategoryRow[]);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Reports load failed', err);
            if (!cancelled) {
                setNotification('Error loading reports data. Check console.');
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [startDate, endDate]);

    // Reset selected slice when filters change
    useEffect(() => {
        setSelectedBucketId(null);
    }, [direction, groupBy, preset, customStart, customEnd, includeTransfers]);

    // ----- Maps -------------------------------------------------------------

    const categoryById = useMemo(() => {
        const m = new Map<string, CategoryRow>();
        categories.forEach(c => m.set(c.id, c));
        return m;
    }, [categories]);

    // Resolve a leaf category id to its "bucket id" depending on groupBy mode.
    // - groupBy === 'category': bucket = the leaf category itself
    // - groupBy === 'group': bucket = the parent group (or the category itself if it's standalone)
    const bucketIdForTx = (tx: Tx): { id: string; name: string; type: CategoryType } => {
        if (!tx.categoryId) {
            return { id: 'uncategorized', name: 'Uncategorized', type: null };
        }
        const cat = categoryById.get(tx.categoryId);
        if (!cat) {
            return { id: 'uncategorized', name: 'Uncategorized', type: null };
        }
        if (groupBy === 'category') {
            return { id: cat.id, name: cat.name, type: cat.type };
        }
        if (cat.parent_id) {
            const parent = categoryById.get(cat.parent_id);
            if (parent) {
                return { id: parent.id, name: parent.name, type: parent.type };
            }
        }
        return { id: cat.id, name: cat.name, type: cat.type };
    };

    // ----- Filtering --------------------------------------------------------

    // Pre-filter transactions by direction & transfer rules.
    const filteredTx = useMemo(() => {
        return transactions.filter(tx => {
            if (!includeTransfers) {
                if (tx.isTransfer) return false;
                const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null;
                if (cat?.type === 'transfer') return false;
            }
            if (direction === 'expense') {
                return tx.amount < 0;
            }
            return tx.amount > 0;
        });
    }, [transactions, direction, includeTransfers, categoryById]);

    // ----- Bucket aggregation -----------------------------------------------

    const buckets: BucketRow[] = useMemo(() => {
        const map = new Map<
            string,
            { id: string; name: string; type: CategoryType; total: number; txCount: number }
        >();

        filteredTx.forEach(tx => {
            const b = bucketIdForTx(tx);
            const value = Math.abs(tx.amount);
            const entry = map.get(b.id);
            if (entry) {
                entry.total += value;
                entry.txCount += 1;
            } else {
                map.set(b.id, {
                    id: b.id,
                    name: b.name,
                    type: b.type,
                    total: value,
                    txCount: 1,
                });
            }
        });

        const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
        return arr.map((row, i) => ({ ...row, color: colorFor(i) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTx, groupBy, categoryById]);

    const colorByBucketId = useMemo(() => {
        const m = new Map<string, string>();
        buckets.forEach(b => m.set(b.id, b.color));
        return m;
    }, [buckets]);

    // ----- Totals & summary -------------------------------------------------

    const grandTotal = useMemo(
        () => buckets.reduce((s, b) => s + b.total, 0),
        [buckets],
    );

    const txTotalCount = useMemo(
        () => buckets.reduce((s, b) => s + b.txCount, 0),
        [buckets],
    );

    const monthsSpanned = useMemo(() => {
        const months = new Set<string>();
        filteredTx.forEach(tx => {
            const dt = new Date(tx.date);
            if (!Number.isNaN(dt.getTime())) months.add(monthKey(dt));
        });
        // If there are no months we at least show "1 month" worth of range
        return Math.max(1, months.size);
    }, [filteredTx]);

    const avgPerMonth = grandTotal / monthsSpanned;

    // ----- Income vs Expenses cashflow summary -------------------------------
    // This is computed independently of the `direction` toggle so users can
    // always see both sides for the selected timeframe.

    const cashflowFilteredTx = useMemo(() => {
        return transactions.filter(tx => {
            if (!includeTransfers) {
                if (tx.isTransfer) return false;
                const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null;
                if (cat?.type === 'transfer') return false;
            }
            return true;
        });
    }, [transactions, includeTransfers, categoryById]);

    const cashflowTotals = useMemo(() => {
        let income = 0;
        let expenses = 0;
        cashflowFilteredTx.forEach(tx => {
            if (tx.amount >= 0) income += tx.amount;
            else expenses += Math.abs(tx.amount);
        });
        const net = income - expenses;
        const savingsRate = income > 0 ? (net / income) * 100 : 0;
        return { income, expenses, net, savingsRate };
    }, [cashflowFilteredTx]);

    const cashflowMonthsSpanned = useMemo(() => {
        const months = new Set<string>();
        cashflowFilteredTx.forEach(tx => {
            const dt = new Date(tx.date);
            if (!Number.isNaN(dt.getTime())) months.add(monthKey(dt));
        });
        return Math.max(1, months.size);
    }, [cashflowFilteredTx]);

    const cashflowMonthly: CashflowMonthRow[] = useMemo(() => {
        const months: string[] = [];
        const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        while (cursor <= endCursor) {
            months.push(monthKey(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }
        const limited = months.slice(-18);

        const idx = new Map<string, CashflowMonthRow>();
        limited.forEach(m => {
            idx.set(m, {
                month: m,
                label: monthLabel(m),
                income: 0,
                expenses: 0,
                net: 0,
            });
        });

        cashflowFilteredTx.forEach(tx => {
            const dt = new Date(tx.date);
            if (Number.isNaN(dt.getTime())) return;
            const key = monthKey(dt);
            const row = idx.get(key);
            if (!row) return;
            if (tx.amount >= 0) row.income += tx.amount;
            else row.expenses += Math.abs(tx.amount);
        });

        const out = Array.from(idx.values());
        out.forEach(r => {
            r.net = r.income - r.expenses;
        });
        return out;
    }, [cashflowFilteredTx, startDate, endDate]);

    // ----- Monthly breakdown for stacked bar --------------------------------

    // We want one row per month over the selected range, with each bucket as a column.
    const monthlyRows: MonthlyBucketRow[] = useMemo(() => {
        // Build month list spanning the requested range
        const months: string[] = [];
        const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        // If range ends mid-month, include that month
        while (cursor <= endCursor) {
            months.push(monthKey(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }

        // Limit to 18 most recent months for readability
        const limited = months.slice(-18);

        const indexByMonth = new Map<string, MonthlyBucketRow>();
        limited.forEach(m => {
            const row: MonthlyBucketRow = {
                month: m,
                label: monthLabel(m),
                total: 0,
            };
            buckets.forEach(b => {
                row[b.id] = 0;
            });
            indexByMonth.set(m, row);
        });

        filteredTx.forEach(tx => {
            const dt = new Date(tx.date);
            if (Number.isNaN(dt.getTime())) return;
            const key = monthKey(dt);
            const row = indexByMonth.get(key);
            if (!row) return;
            const b = bucketIdForTx(tx);
            const v = Math.abs(tx.amount);
            row[b.id] = ((row[b.id] as number) ?? 0) + v;
            row.total += v;
        });

        return Array.from(indexByMonth.values());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTx, buckets, startDate, endDate, groupBy]);

    // ----- Transaction list (all rows in view, or bucket-filtered) ---------

    const visibleReportTx = useMemo(() => {
        const base = selectedBucketId
            ? filteredTx.filter(tx => bucketIdForTx(tx).id === selectedBucketId)
            : filteredTx;
        const sorted = [...base];
        if (txListSort === 'date_desc') {
            sorted.sort((a, b) => {
                if (a.date < b.date) return 1;
                if (a.date > b.date) return -1;
                return b.id.localeCompare(a.id);
            });
        } else if (txListSort === 'amount_desc') {
            sorted.sort((a, b) => {
                const d = Math.abs(b.amount) - Math.abs(a.amount);
                if (d !== 0) return d;
                if (a.date < b.date) return 1;
                if (a.date > b.date) return -1;
                return b.id.localeCompare(a.id);
            });
        } else {
            sorted.sort((a, b) => {
                const d = Math.abs(a.amount) - Math.abs(b.amount);
                if (d !== 0) return d;
                if (a.date < b.date) return 1;
                if (a.date > b.date) return -1;
                return a.id.localeCompare(b.id);
            });
        }
        return sorted;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTx, selectedBucketId, groupBy, categoryById, txListSort]);

    const selectedBucket = useMemo(
        () => buckets.find(b => b.id === selectedBucketId) ?? null,
        [buckets, selectedBucketId],
    );

    // ----- Pie / chart datasets ---------------------------------------------

    const TOP_N = 8;
    const pieData = useMemo(() => {
        if (buckets.length <= TOP_N) return buckets;
        const top = buckets.slice(0, TOP_N);
        const otherTotal = buckets
            .slice(TOP_N)
            .reduce((s, b) => s + b.total, 0);
        const otherCount = buckets
            .slice(TOP_N)
            .reduce((s, b) => s + b.txCount, 0);
        return [
            ...top,
            {
                id: 'other',
                name: `Other (${buckets.length - TOP_N})`,
                type: null as CategoryType,
                total: otherTotal,
                txCount: otherCount,
                color: '#64748b',
            },
        ];
    }, [buckets]);

    const directionLabel = direction === 'expense' ? 'Spending' : 'Income';

    // ----- Render -----------------------------------------------------------

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Reports</h2>
                    <p className="text-xs text-slate-400">
                        {directionLabel} breakdown by{' '}
                        {groupBy === 'group' ? 'category group' : 'category'} ·{' '}
                        {periodLabel}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Direction */}
                    <div className="inline-flex rounded-full border border-slate-700 bg-slate-950 p-0.5">
                        {(['expense', 'income'] as Direction[]).map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDirection(d)}
                                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                                    direction === d
                                        ? 'bg-amber-400 text-black'
                                        : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                {d === 'expense' ? 'Spending' : 'Income'}
                            </button>
                        ))}
                    </div>

                    {/* Group by */}
                    <div className="inline-flex rounded-full border border-slate-700 bg-slate-950 p-0.5">
                        {([
                            { id: 'group' as GroupBy, label: 'By group' },
                            { id: 'category' as GroupBy, label: 'By category' },
                        ]).map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setGroupBy(opt.id)}
                                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                                    groupBy === opt.id
                                        ? 'bg-amber-400 text-black'
                                        : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-300">
                        <input
                            type="checkbox"
                            className="h-3 w-3 accent-amber-400"
                            checked={includeTransfers}
                            onChange={e => setIncludeTransfers(e.target.checked)}
                        />
                        Include transfers
                    </label>
                </div>
            </div>

            {/* Range filter row */}
            <div className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-slate-400">Range:</span>
                    {([
                        { id: '1w' as RangePreset, label: '1W' },
                        { id: '1m' as RangePreset, label: '1M' },
                        { id: '3m' as RangePreset, label: '3M' },
                        { id: '6m' as RangePreset, label: '6M' },
                        { id: '12m' as RangePreset, label: '12M' },
                        { id: 'ytd' as RangePreset, label: 'YTD' },
                        { id: 'all' as RangePreset, label: 'All' },
                        { id: 'custom' as RangePreset, label: 'Custom' },
                    ]).map(opt => (
                        <FilterChip
                            key={opt.id}
                            active={preset === opt.id}
                            onClick={() => setPreset(opt.id)}
                        >
                            {opt.label}
                        </FilterChip>
                    ))}
                </div>

                {preset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                        <label className="flex items-center gap-1.5">
                            <span className="text-slate-400">From</span>
                            <input
                                type="date"
                                value={customStart ?? ''}
                                onChange={e => setCustomStart(e.target.value || null)}
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                            />
                        </label>
                        <label className="flex items-center gap-1.5">
                            <span className="text-slate-400">To</span>
                            <input
                                type="date"
                                value={customEnd ?? ''}
                                onChange={e => setCustomEnd(e.target.value || null)}
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                            />
                        </label>
                    </div>
                )}
            </div>

            {notification && (
                <div className="rounded-md border border-red-700 bg-red-950 px-4 py-2 text-xs text-red-200">
                    {notification}
                </div>
            )}

            {/* Transactions list (matches period, direction, transfers toggle; optional bucket filter) */}
            {!loading && (
                <div className={cardClass}>
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold">
                                {selectedBucket ? (
                                    <>
                                        <span
                                            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                                            style={{ background: selectedBucket.color }}
                                        />
                                        {selectedBucket.name}
                                    </>
                                ) : (
                                    'Transactions'
                                )}
                            </h3>
                            <p className="text-[10px] text-slate-500">
                                {periodLabel} · {directionLabel}
                                {selectedBucket
                                    ? ` · ${visibleReportTx.length} transaction${
                                          visibleReportTx.length === 1 ? '' : 's'
                                      } · ${moneyFmt.format(selectedBucket.total)}`
                                    : ` · ${visibleReportTx.length} transaction${
                                          visibleReportTx.length === 1 ? '' : 's'
                                      }`}
                                {!selectedBucketId
                                    ? ' · use the breakdown table below to filter by row'
                                    : ''}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-[10px] text-slate-500">Sort</label>
                            <select
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                                value={txListSort}
                                onChange={e =>
                                    setTxListSort(
                                        e.target.value as 'date_desc' | 'amount_desc' | 'amount_asc',
                                    )
                                }
                            >
                                <option value="date_desc">Recent</option>
                                <option value="amount_desc">Amount: high → low</option>
                                <option value="amount_asc">Amount: low → high</option>
                            </select>
                            <Link
                                href="/finance/transactions"
                                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                            >
                                Open transactions →
                            </Link>
                        </div>
                    </div>

                    {visibleReportTx.length === 0 ? (
                        <p className="text-slate-400">
                            No {direction === 'expense' ? 'spending' : 'income'} transactions in this
                            view.
                        </p>
                    ) : (
                        <div className="max-h-[360px] overflow-y-auto">
                            <table className="w-full border-collapse text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-800 text-left text-slate-400">
                                        <th className="py-1.5 pr-2">Date</th>
                                        {!selectedBucketId && (
                                            <th className="py-1.5 pr-2">
                                                {groupBy === 'group' ? 'Group' : 'Category'}
                                            </th>
                                        )}
                                        <th className="py-1.5 pr-2">Description</th>
                                        <th className="py-1.5 pr-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleReportTx.slice(0, 200).map(tx => {
                                        const desc =
                                            tx.name?.trim() ||
                                            tx.note?.trim() ||
                                            (tx.categoryId
                                                ? categoryById.get(tx.categoryId)?.name
                                                : null) ||
                                            'Transaction';
                                        const bucket = bucketIdForTx(tx);
                                        return (
                                            <tr
                                                key={tx.id}
                                                className="border-b border-slate-900 last:border-b-0"
                                            >
                                                <td className="py-1 pr-2 text-slate-300">
                                                    {tx.date}
                                                </td>
                                                {!selectedBucketId && (
                                                    <td className="py-1 pr-2 text-slate-400">
                                                        <span className="truncate">{bucket.name}</span>
                                                    </td>
                                                )}
                                                <td className="py-1 pr-2 text-slate-100">
                                                    {desc}
                                                </td>
                                                <td
                                                    className={`py-1 pr-2 text-right tabular-nums ${
                                                        tx.amount < 0
                                                            ? 'text-red-400'
                                                            : 'text-emerald-400'
                                                    }`}
                                                >
                                                    {moneyFmt.format(Math.abs(tx.amount))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {visibleReportTx.length > 200 && (
                                <p className="mt-2 text-[10px] text-slate-500">
                                    Showing 200 of {visibleReportTx.length}. Use the Transactions tab
                                    to see them all.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Income vs Expenses summary (always shown for the timeframe) */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className={cardClass}>
                    <h3 className="text-sm font-semibold">Income vs Expenses</h3>
                    <p className="text-[10px] text-slate-500">
                        {periodLabel}
                        {!includeTransfers && ' · excludes transfers'}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-emerald-900/60 bg-emerald-950/30 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                                Income
                            </p>
                            <p className="mt-1 text-lg font-semibold text-emerald-400 tabular-nums">
                                {moneyFmt.format(cashflowTotals.income)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                                {moneyFmt.format(cashflowTotals.income / cashflowMonthsSpanned)} / mo
                            </p>
                        </div>
                        <div className="rounded-md border border-red-900/60 bg-red-950/30 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-red-400/80">
                                Expenses
                            </p>
                            <p className="mt-1 text-lg font-semibold text-red-400 tabular-nums">
                                {moneyFmt.format(cashflowTotals.expenses)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                                {moneyFmt.format(cashflowTotals.expenses / cashflowMonthsSpanned)} / mo
                            </p>
                        </div>
                    </div>

                    {/* Net + savings rate */}
                    <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                Net cashflow
                            </p>
                            <p
                                className={`text-[10px] font-medium ${
                                    cashflowTotals.net >= 0
                                        ? 'text-emerald-400'
                                        : 'text-red-400'
                                }`}
                            >
                                {cashflowTotals.income > 0
                                    ? `${cashflowTotals.savingsRate >= 0 ? '' : ''}${cashflowTotals.savingsRate.toFixed(1)}% savings rate`
                                    : '—'}
                            </p>
                        </div>
                        <p
                            className={`mt-1 text-xl font-bold tabular-nums ${
                                cashflowTotals.net >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                            }`}
                        >
                            {cashflowTotals.net >= 0 ? '+' : '−'}
                            {moneyFmt.format(Math.abs(cashflowTotals.net))}
                        </p>

                        {/* Income/expense ratio bar */}
                        {(cashflowTotals.income > 0 || cashflowTotals.expenses > 0) && (
                            <div className="mt-2">
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                                    {(() => {
                                        const sum =
                                            cashflowTotals.income +
                                            cashflowTotals.expenses;
                                        if (sum === 0) return null;
                                        const incomePct =
                                            (cashflowTotals.income / sum) * 100;
                                        const expensesPct =
                                            (cashflowTotals.expenses / sum) * 100;
                                        return (
                                            <>
                                                <div
                                                    className="bg-emerald-500"
                                                    style={{ width: `${incomePct}%` }}
                                                    title={`Income ${incomePct.toFixed(1)}%`}
                                                />
                                                <div
                                                    className="bg-red-500"
                                                    style={{ width: `${expensesPct}%` }}
                                                    title={`Expenses ${expensesPct.toFixed(1)}%`}
                                                />
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                                    <span>Income</span>
                                    <span>Expenses</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Income vs Expenses per month chart */}
                <div className={`${cardClass} lg:col-span-2`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold">Cashflow per month</h3>
                            <p className="text-[10px] text-slate-500">
                                Income, expenses, and net over time (last 18 months max)
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <p className="mt-6 text-slate-400">Loading…</p>
                    ) : cashflowMonthly.length === 0 ? (
                        <p className="mt-6 text-slate-400">No data in this period.</p>
                    ) : (
                        <div className="mt-3 h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={cashflowMonthly}
                                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                                    barGap={2}
                                    barCategoryGap="18%"
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(148,163,184,0.15)"
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={v => compactMoneyFmt.format(v)}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={48}
                                    />
                                    <ReferenceLine
                                        y={0}
                                        stroke="rgba(148,163,184,0.4)"
                                        strokeWidth={1}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                                        contentStyle={{
                                            background: '#0f172a',
                                            border: '1px solid #334155',
                                            borderRadius: 8,
                                            fontSize: 11,
                                            color: '#e2e8f0',
                                        }}
                                        formatter={(value, name) => {
                                            const num = Number(value ?? 0);
                                            const key = String(name ?? '');
                                            const display =
                                                key === 'net' && num < 0
                                                    ? `−${moneyFmt.format(Math.abs(num))}`
                                                    : moneyFmt.format(num);
                                            const labelMap: Record<string, string> = {
                                                income: 'Income',
                                                expenses: 'Expenses',
                                                net: 'Net',
                                            };
                                            return [display, labelMap[key] ?? key];
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: 11,
                                            color: '#cbd5e1',
                                        }}
                                        formatter={value => {
                                            const labelMap: Record<string, string> = {
                                                income: 'Income',
                                                expenses: 'Expenses',
                                                net: 'Net',
                                            };
                                            return labelMap[value] ?? value;
                                        }}
                                    />
                                    <Bar
                                        dataKey="income"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="expenses"
                                        fill="#ef4444"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="net"
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#f59e0b' }}
                                        activeDot={{ r: 5 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Category breakdown header */}
            <div className="flex items-center justify-between pt-1">
                <h3 className="text-sm font-semibold text-slate-200">
                    {directionLabel} by{' '}
                    {groupBy === 'group' ? 'group' : 'category'}
                </h3>
                <span className="text-[10px] text-slate-500">
                    Switch direction or grouping in the toolbar above
                </span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className={cardClass}>
                    <p className="text-[10px] uppercase text-slate-400">
                        Total {directionLabel.toLowerCase()}
                    </p>
                    <p
                        className={`mt-1 text-lg font-semibold ${
                            direction === 'expense' ? 'text-red-400' : 'text-emerald-400'
                        }`}
                    >
                        {moneyFmt.format(grandTotal)}
                    </p>
                </div>
                <div className={cardClass}>
                    <p className="text-[10px] uppercase text-slate-400">
                        Avg / month
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                        {moneyFmt.format(avgPerMonth)}
                    </p>
                </div>
                <div className={cardClass}>
                    <p className="text-[10px] uppercase text-slate-400">
                        Transactions
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                        {txTotalCount.toLocaleString()}
                    </p>
                </div>
                <div className={cardClass}>
                    <p className="text-[10px] uppercase text-slate-400">
                        Top {groupBy === 'group' ? 'group' : 'category'}
                    </p>
                    {buckets[0] ? (
                        <>
                            <p
                                className="mt-1 truncate text-sm font-semibold"
                                style={{ color: buckets[0].color }}
                                title={buckets[0].name}
                            >
                                {buckets[0].name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                {moneyFmt.format(buckets[0].total)}
                                {grandTotal > 0 && (
                                    <>
                                        {' · '}
                                        {((buckets[0].total / grandTotal) * 100).toFixed(1)}%
                                    </>
                                )}
                            </p>
                        </>
                    ) : (
                        <p className="mt-1 text-sm text-slate-500">—</p>
                    )}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Pie chart */}
                <div className={`${cardClass} lg:col-span-2`}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            {directionLabel} by{' '}
                            {groupBy === 'group' ? 'group' : 'category'}
                        </h3>
                        {selectedBucket && (
                            <button
                                type="button"
                                onClick={() => setSelectedBucketId(null)}
                                className="text-[10px] text-slate-400 hover:text-amber-300"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <p className="mt-6 text-slate-400">Loading…</p>
                    ) : pieData.length === 0 ? (
                        <p className="mt-6 text-slate-400">
                            No {direction === 'expense' ? 'spending' : 'income'} in this period.
                        </p>
                    ) : (
                        <div className="mt-3 h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="total"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={110}
                                        paddingAngle={1}
                                        onClick={(_, idx) => {
                                            const slice = pieData[idx];
                                            if (!slice) return;
                                            if (slice.id === 'other') return;
                                            setSelectedBucketId(
                                                selectedBucketId === slice.id ? null : slice.id,
                                            );
                                        }}
                                    >
                                        {pieData.map(slice => (
                                            <Cell
                                                key={slice.id}
                                                fill={slice.color}
                                                opacity={
                                                    selectedBucketId === null ||
                                                    selectedBucketId === slice.id
                                                        ? 1
                                                        : 0.25
                                                }
                                                stroke="rgba(15,23,42,0.6)"
                                                style={{ cursor: 'pointer' }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: '#0f172a',
                                            border: '1px solid #334155',
                                            borderRadius: 8,
                                            fontSize: 11,
                                            color: '#e2e8f0',
                                        }}
                                        formatter={(value, _name, item) => {
                                            const num = Number(value ?? 0);
                                            const payload = item?.payload as
                                                | { name?: string; txCount?: number }
                                                | undefined;
                                            const pct =
                                                grandTotal > 0
                                                    ? ` (${((num / grandTotal) * 100).toFixed(1)}%)`
                                                    : '';
                                            return [
                                                `${moneyFmt.format(num)}${pct}`,
                                                payload?.name ?? '',
                                            ];
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Top categories bar */}
                <div className={cardClass}>
                    <h3 className="text-sm font-semibold">Top 8</h3>
                    {loading ? (
                        <p className="mt-6 text-slate-400">Loading…</p>
                    ) : buckets.length === 0 ? (
                        <p className="mt-6 text-slate-400">No data.</p>
                    ) : (
                        <div className="mt-3 h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={buckets.slice(0, 8)}
                                    layout="vertical"
                                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(148,163,184,0.15)"
                                    />
                                    <XAxis
                                        type="number"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={v => compactMoneyFmt.format(v)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={100}
                                        tick={{ fontSize: 10, fill: '#cbd5e1' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                        contentStyle={{
                                            background: '#0f172a',
                                            border: '1px solid #334155',
                                            borderRadius: 8,
                                            fontSize: 11,
                                            color: '#e2e8f0',
                                        }}
                                        formatter={value => moneyFmt.format(Number(value ?? 0))}
                                    />
                                    <Bar
                                        dataKey="total"
                                        radius={[0, 4, 4, 0]}
                                        onClick={(_, idx) => {
                                            const b = buckets[idx];
                                            if (!b) return;
                                            setSelectedBucketId(
                                                selectedBucketId === b.id ? null : b.id,
                                            );
                                        }}
                                    >
                                        {buckets.slice(0, 8).map(b => (
                                            <Cell
                                                key={b.id}
                                                fill={b.color}
                                                opacity={
                                                    selectedBucketId === null ||
                                                    selectedBucketId === b.id
                                                        ? 1
                                                        : 0.35
                                                }
                                                style={{ cursor: 'pointer' }}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Monthly stacked bar */}
            {monthlyRows.length > 1 && buckets.length > 0 && (
                <div className={cardClass}>
                    <h3 className="text-sm font-semibold">
                        {directionLabel} per month
                    </h3>
                    <p className="text-[10px] text-slate-500">
                        Stacked by {groupBy === 'group' ? 'group' : 'category'} ·{' '}
                        showing up to 18 months
                    </p>
                    <div className="mt-3 h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyRows}
                                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(148,163,184,0.15)"
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={v => compactMoneyFmt.format(v)}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={48}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: 8,
                                        fontSize: 11,
                                        color: '#e2e8f0',
                                    }}
                                    formatter={value => moneyFmt.format(Number(value ?? 0))}
                                />
                                {buckets.map(b => (
                                    <Bar
                                        key={b.id}
                                        dataKey={b.id}
                                        name={b.name}
                                        stackId="month"
                                        fill={b.color}
                                        opacity={
                                            selectedBucketId === null ||
                                            selectedBucketId === b.id
                                                ? 1
                                                : 0.25
                                        }
                                        onClick={() =>
                                            setSelectedBucketId(
                                                selectedBucketId === b.id ? null : b.id,
                                            )
                                        }
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Detail table */}
            <div className={cardClass}>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                        {groupBy === 'group' ? 'Groups' : 'Categories'}
                    </h3>
                    <span className="text-[10px] text-slate-500">
                        Click a row to filter
                    </span>
                </div>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : buckets.length === 0 ? (
                    <p className="text-slate-400">
                        No {direction === 'expense' ? 'spending' : 'income'} in this period.
                    </p>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="border-b border-slate-800 text-left text-slate-400">
                                    <th className="py-2 pr-2">
                                        {groupBy === 'group' ? 'Group' : 'Category'}
                                    </th>
                                    <th className="py-2 pr-2 text-right">Total</th>
                                    <th className="py-2 pr-2 text-right">% of total</th>
                                    <th className="py-2 pr-2 text-right">Avg / mo</th>
                                    <th className="py-2 pr-2 text-right">Txns</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buckets.map(b => {
                                    const pct =
                                        grandTotal > 0 ? (b.total / grandTotal) * 100 : 0;
                                    const isSelected = selectedBucketId === b.id;
                                    return (
                                        <tr
                                            key={b.id}
                                            onClick={() =>
                                                setSelectedBucketId(
                                                    isSelected ? null : b.id,
                                                )
                                            }
                                            className={`cursor-pointer border-b border-slate-900 last:border-b-0 transition-colors ${
                                                isSelected
                                                    ? 'bg-slate-800/60'
                                                    : 'hover:bg-slate-800/30'
                                            }`}
                                        >
                                            <td className="py-1.5 pr-2 text-slate-100">
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                                                        style={{ background: b.color }}
                                                    />
                                                    <span className="truncate">{b.name}</span>
                                                </span>
                                            </td>
                                            <td
                                                className={`py-1.5 pr-2 text-right font-medium ${
                                                    direction === 'expense'
                                                        ? 'text-red-400'
                                                        : 'text-emerald-400'
                                                }`}
                                            >
                                                {moneyFmt.format(b.total)}
                                            </td>
                                            <td className="py-1.5 pr-2 text-right text-slate-300">
                                                <span className="inline-flex w-full items-center justify-end gap-2">
                                                    <span
                                                        className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-800 sm:inline-block"
                                                        aria-hidden
                                                    >
                                                        <span
                                                            className="block h-full"
                                                            style={{
                                                                width: `${Math.min(100, pct)}%`,
                                                                background: b.color,
                                                            }}
                                                        />
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="py-1.5 pr-2 text-right text-slate-300 tabular-nums">
                                                {moneyFmt.format(b.total / monthsSpanned)}
                                            </td>
                                            <td className="py-1.5 pr-2 text-right text-slate-300 tabular-nums">
                                                {b.txCount}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-700 text-slate-200">
                                    <td className="py-2 pr-2 font-semibold">Total</td>
                                    <td
                                        className={`py-2 pr-2 text-right font-semibold ${
                                            direction === 'expense'
                                                ? 'text-red-400'
                                                : 'text-emerald-400'
                                        }`}
                                    >
                                        {moneyFmt.format(grandTotal)}
                                    </td>
                                    <td className="py-2 pr-2 text-right">100%</td>
                                    <td className="py-2 pr-2 text-right tabular-nums">
                                        {moneyFmt.format(avgPerMonth)}
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums">
                                        {txTotalCount}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
