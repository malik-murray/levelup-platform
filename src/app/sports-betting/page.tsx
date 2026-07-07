'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import AppSidebar from '@/app/dashboard/components/AppSidebar';

type Bet = {
    id: string;
    match_date: string;
    competition: string;
    home_team: string;
    away_team: string;
    market: 'h2h' | 'totals_2.5' | 'btts';
    selection: string;
    model_prob: number;
    primary_book: string;
    primary_price: number | null;
    primary_edge: number | null;
    best_book: string | null;
    best_price: number | null;
    best_edge: number | null;
    confidence: string;
    result: 'win' | 'loss' | null;
};

const SELECTION_LABEL: Record<string, Record<string, string>> = {
    h2h: { home: 'Home ML', draw: 'Draw', away: 'Away ML' },
    'totals_2.5': { over: 'Over 2.5', under: 'Under 2.5' },
    btts: { yes: 'BTTS Yes', no: 'BTTS No' },
};

const betLabel = (bet: Bet) => SELECTION_LABEL[bet.market]?.[bet.selection] ?? `${bet.market}:${bet.selection}`;

const pct = (n: number | null) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`);

const confidenceColor = (confidence: string) => {
    if (confidence === 'High') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300';
    if (confidence === 'Medium') return 'border-amber-400/40 bg-amber-500/15 text-amber-300';
    return 'border-white/20 bg-white/10 text-slate-300';
};

const resultBadge = (result: Bet['result']) => {
    if (result === 'win') return <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Win</span>;
    if (result === 'loss') return <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Loss</span>;
    return <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">Pending</span>;
};

export default function SportsBettingPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bets, setBets] = useState<Bet[]>([]);
    const [lastRunDate, setLastRunDate] = useState<string | null>(null);

    useEffect(() => {
        void loadBets();
    }, []);

    const loadBets = async () => {
        setLoading(true);
        setError(null);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                return;
            }

            const { data: latestRun, error: runError } = await supabase
                .from('sports_betting_runs')
                .select('run_date')
                .eq('user_id', user.id)
                .order('run_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (runError) throw runError;

            if (!latestRun) {
                setBets([]);
                setLastRunDate(null);
                return;
            }

            setLastRunDate(latestRun.run_date);

            const { data, error: betsError } = await supabase
                .from('sports_betting_bets')
                .select('*')
                .eq('user_id', user.id)
                .eq('match_date', latestRun.run_date)
                .order('primary_edge', { ascending: false, nullsFirst: false });

            if (betsError) throw betsError;

            setBets((data || []) as Bet[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sports betting picks');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#070B17] text-slate-100">
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="mx-auto min-h-screen w-full max-w-2xl bg-gradient-to-b from-[#0A1022] via-[#0A0F1F] to-[#060A15] pb-20">
                <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070B17]/95 px-4 pb-3 pt-5 backdrop-blur">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                            aria-label="Open menu"
                            onClick={() => setSidebarOpen(true)}
                        >
                            ☰
                        </button>
                        <h1 className="text-lg font-semibold text-slate-100">⚽ Sports Betting Bot</h1>
                        <button
                            type="button"
                            onClick={() => void loadBets()}
                            className="rounded-lg border border-amber-400/30 bg-amber-500/20 px-2 py-1 text-[11px] text-amber-200"
                        >
                            Refresh
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        {lastRunDate
                            ? `Last updated ${new Date(`${lastRunDate}T00:00:00`).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                              })} — ranked by edge, best value first.`
                            : 'No picks yet — the daily pipeline runs automatically each morning.'}
                    </p>
                </header>

                <div className="space-y-3 px-3 py-4">
                    {loading && <p className="px-1 text-sm text-slate-400">Loading…</p>}
                    {error && (
                        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                            {error}
                        </p>
                    )}
                    {!loading && !error && bets.length === 0 && (
                        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-slate-400">
                            No bets cleared the minimum edge threshold for the latest run.
                        </p>
                    )}

                    {bets.map((bet) => {
                        const usePrimary =
                            bet.primary_edge !== null && (bet.best_edge === null || bet.primary_edge >= bet.best_edge - 1e-9);
                        const headlineBook = usePrimary ? bet.primary_book : bet.best_book;
                        const headlinePrice = usePrimary ? bet.primary_price : bet.best_price;
                        const headlineEdge = usePrimary ? bet.primary_edge : bet.best_edge;
                        const lineShopNote =
                            bet.primary_price && bet.best_price && bet.best_book !== bet.primary_book && bet.best_price > bet.primary_price
                                ? `${bet.best_book} @ ${bet.best_price.toFixed(2)} is better`
                                : null;

                        return (
                            <div key={bet.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-100">
                                            {bet.home_team} vs {bet.away_team}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {bet.competition} · {betLabel(bet)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span
                                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceColor(bet.confidence)}`}
                                        >
                                            {bet.confidence}
                                        </span>
                                        {resultBadge(bet.result)}
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Model Prob</p>
                                        <p className="text-slate-100">{pct(bet.model_prob)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Best Line</p>
                                        <p className="text-slate-100">
                                            {headlineBook ? `${headlineBook} @ ${headlinePrice?.toFixed(2)}` : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Edge</p>
                                        <p className="font-semibold text-emerald-300">
                                            {headlineEdge !== null ? `${(headlineEdge * 100).toFixed(1)}%` : '—'}
                                        </p>
                                    </div>
                                </div>

                                {lineShopNote && (
                                    <p className="mt-2 text-xs text-amber-300">{lineShopNote}</p>
                                )}
                            </div>
                        );
                    })}

                    <p className="px-1 pt-2 text-[11px] leading-relaxed text-slate-500">
                        Statistical model estimates, not guarantees — treat &ldquo;Low (limited history)&rdquo; confidence
                        bets as noise, not signal. This tool only reports picks; place any bets manually in the FanDuel app
                        (automated bet placement violates sportsbook terms of service).
                    </p>
                </div>
            </div>
        </main>
    );
}
