'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function MarketDetailPage() {
    const params = useParams();
    const symbol = (params.symbol as string).toUpperCase();

    // Mock data
    const mockPrice = 2847.32;
    const mockChange = 45.67;
    const mockChangePercent = 1.63;
    const isPositive = mockChange >= 0;

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Stock & Crypto Analyzer</h1>
                            <p className="text-xs text-slate-400 mt-0.5">{symbol} Detail</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/markets"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Watchlist
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
                {/* Price Header */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-3xl font-bold">{symbol}</h2>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-slate-200">
                                ${mockPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className={`text-lg font-semibold mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}${mockChange.toFixed(2)} ({isPositive ? '+' : ''}{mockChangePercent.toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Price Chart Placeholder */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Price Chart</h3>
                    <div className="h-64 rounded-md border border-slate-800 bg-slate-900 flex items-center justify-center">
                        <p className="text-sm text-slate-400">Chart placeholder - Connect to market data API</p>
                    </div>
                </div>

                {/* Key Stats */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Key Stats</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
                            <div className="text-xs text-slate-400 mb-1">24h High</div>
                            <div className="text-sm font-semibold text-slate-200">$2,890.45</div>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
                            <div className="text-xs text-slate-400 mb-1">24h Low</div>
                            <div className="text-sm font-semibold text-slate-200">$2,801.23</div>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
                            <div className="text-xs text-slate-400 mb-1">Volume</div>
                            <div className="text-sm font-semibold text-slate-200">$1.2B</div>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
                            <div className="text-xs text-slate-400 mb-1">Market Cap</div>
                            <div className="text-sm font-semibold text-slate-200">$342B</div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Notes</h3>
                    <textarea
                        placeholder="Add your notes, thoughts, or analysis about this asset..."
                        className="w-full h-32 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                    />
                    <button className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300 transition-colors">
                        Save Notes
                    </button>
                </div>
            </div>
        </main>
    );
}

