'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import AppSidebar from '@/app/dashboard/components/AppSidebar';

type Listing = {
    id: string;
    run_date: string;
    buy_signal_score: number | null;
    buy_signal_rationale: string | null;
    address: string;
    city: string;
    state: string;
    home_type: string | null;
    built_year: number | null;
    beds: number | null;
    baths: number | null;
    price: number;
    hoa_monthly: number | null;
    est_monthly_10pct_down: number | null;
    est_monthly_with_dpa: number | null;
    fits_budget: 'yes' | 'no' | 'tight' | null;
    source_url: string | null;
    source_label: string | null;
};

const currency = (n: number | null) =>
    n === null || n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const scoreColor = (score: number | null) => {
    if (score === null) return 'border-white/20 bg-white/10 text-slate-300';
    if (score >= 7) return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300';
    if (score >= 5) return 'border-amber-400/40 bg-amber-500/15 text-amber-300';
    return 'border-rose-400/40 bg-rose-500/15 text-rose-300';
};

const fitsBudgetLabel: Record<string, string> = {
    yes: 'Fits budget',
    tight: 'Tight fit',
    no: 'Over budget',
};

export default function HomeSearchPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [listings, setListings] = useState<Listing[]>([]);
    const [lastRunDate, setLastRunDate] = useState<string | null>(null);

    useEffect(() => {
        void loadListings();
    }, []);

    const loadListings = async () => {
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
                .from('home_search_runs')
                .select('run_date')
                .eq('user_id', user.id)
                .order('run_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (runError) throw runError;

            if (!latestRun) {
                setListings([]);
                setLastRunDate(null);
                return;
            }

            setLastRunDate(latestRun.run_date);

            const { data, error: listingsError } = await supabase
                .from('home_search_listings')
                .select('*')
                .eq('user_id', user.id)
                .eq('run_date', latestRun.run_date)
                .order('buy_signal_score', { ascending: false, nullsFirst: false });

            if (listingsError) throw listingsError;

            setListings((data || []) as Listing[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load home search results');
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
                        <h1 className="text-lg font-semibold text-slate-100">🏡 Home Search</h1>
                        <button
                            type="button"
                            onClick={() => void loadListings()}
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
                              })} — ranked by Buy Signal, best deals first.`
                            : 'No results yet — the daily search runs automatically each morning.'}
                    </p>
                </header>

                <div className="space-y-3 px-3 py-4">
                    {loading && <p className="px-1 text-sm text-slate-400">Loading…</p>}
                    {error && (
                        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                            {error}
                        </p>
                    )}
                    {!loading && !error && listings.length === 0 && (
                        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-slate-400">
                            No matching listings found yet. The daily search checks Prince George&apos;s County, MD and
                            Woodbridge/Lorton, VA for 3bd/2+ba homes built 2020+ under $470K.
                        </p>
                    )}

                    {listings.map((listing) => (
                        <div key={listing.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-100">{listing.address}</p>
                                    <p className="text-xs text-slate-400">
                                        {listing.city}, {listing.state}
                                        {listing.built_year ? ` · Built ${listing.built_year}` : ''}
                                    </p>
                                </div>
                                <span
                                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(listing.buy_signal_score)}`}
                                >
                                    {listing.buy_signal_score !== null ? `${listing.buy_signal_score}/10` : '—'}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Price</p>
                                    <p className="text-slate-100">{currency(listing.price)}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Beds/Baths</p>
                                    <p className="text-slate-100">
                                        {listing.beds ?? '—'}bd / {listing.baths ?? '—'}ba
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">HOA</p>
                                    <p className="text-slate-100">
                                        {listing.hoa_monthly ? `${currency(listing.hoa_monthly)}/mo` : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Fit</p>
                                    <p className="text-slate-100">
                                        {listing.fits_budget ? fitsBudgetLabel[listing.fits_budget] : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Monthly (10% down)</p>
                                    <p className="font-semibold text-slate-100">{currency(listing.est_monthly_10pct_down)}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Monthly (w/ DPA)</p>
                                    <p className="font-semibold text-slate-100">{currency(listing.est_monthly_with_dpa)}</p>
                                </div>
                            </div>

                            {listing.buy_signal_rationale && (
                                <p className="mt-3 text-xs leading-relaxed text-slate-400">{listing.buy_signal_rationale}</p>
                            )}

                            {listing.source_url && (
                                <a
                                    href={listing.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-block text-xs font-medium text-amber-300 hover:text-amber-200"
                                >
                                    {listing.source_label || 'View listing'} →
                                </a>
                            )}
                        </div>
                    ))}

                    <p className="px-1 pt-2 text-[11px] leading-relaxed text-slate-500">
                        Best-effort web-search-based estimates, not live MLS data. Confirm current status/price on Redfin or
                        Zillow directly before making any offer.
                    </p>
                </div>
            </div>
        </main>
    );
}
