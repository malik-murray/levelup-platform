'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type WatchlistItem = {
    id: string;
    symbol: string;
    lastPrice: number;
    dailyChange: number;
    dailyChangePercent: number;
    notes?: string;
};

export default function MarketsPage() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
        { id: '1', symbol: 'ETH', lastPrice: 2847.32, dailyChange: 45.67, dailyChangePercent: 1.63 },
        { id: '2', symbol: 'BTC', lastPrice: 42356.78, dailyChange: -234.12, dailyChangePercent: -0.55 },
        { id: '3', symbol: 'AAPL', lastPrice: 178.45, dailyChange: 2.34, dailyChangePercent: 1.33 },
        { id: '4', symbol: 'TSLA', lastPrice: 245.67, dailyChange: -5.23, dailyChangePercent: -2.08 },
        { id: '5', symbol: 'SPY', lastPrice: 456.78, dailyChange: 3.45, dailyChangePercent: 0.76 },
    ]);

    const [newSymbol, setNewSymbol] = useState('');

    const handleAddSymbol = () => {
        if (newSymbol.trim()) {
            const mockPrice = Math.random() * 1000;
            const mockChange = (Math.random() - 0.5) * 50;
            setWatchlist(prev => [...prev, {
                id: Date.now().toString(),
                symbol: newSymbol.trim().toUpperCase(),
                lastPrice: mockPrice,
                dailyChange: mockChange,
                dailyChangePercent: (mockChange / mockPrice) * 100,
            }]);
            setNewSymbol('');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

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
                            <p className="text-xs text-slate-400 mt-0.5">Monitor portfolios & watchlists</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
                {/* Watchlist */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Watchlist</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSymbol}
                                onChange={e => setNewSymbol(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSymbol()}
                                placeholder="Add symbol (e.g., ETH, AAPL)"
                                className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none w-40"
                            />
                            <button
                                onClick={handleAddSymbol}
                                className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400">
                                    <th className="text-left py-2 px-2">Symbol</th>
                                    <th className="text-right py-2 px-2">Last Price</th>
                                    <th className="text-right py-2 px-2">Daily Change</th>
                                    <th className="text-right py-2 px-2">Change %</th>
                                    <th className="text-center py-2 px-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchlist.map(item => {
                                    const isPositive = item.dailyChange >= 0;
                                    return (
                                        <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-900 transition-colors">
                                            <td className="py-3 px-2">
                                                <Link
                                                    href={`/markets/${item.symbol.toLowerCase()}`}
                                                    className="font-semibold text-amber-400 hover:text-amber-300"
                                                >
                                                    {item.symbol}
                                                </Link>
                                            </td>
                                            <td className="text-right py-3 px-2 text-slate-200">{formatCurrency(item.lastPrice)}</td>
                                            <td className={`text-right py-3 px-2 font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{formatCurrency(item.dailyChange)}
                                            </td>
                                            <td className={`text-right py-3 px-2 font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{item.dailyChangePercent.toFixed(2)}%
                                            </td>
                                            <td className="text-center py-3 px-2">
                                                <Link
                                                    href={`/markets/${item.symbol.toLowerCase()}`}
                                                    className="text-xs text-slate-400 hover:text-amber-400"
                                                >
                                                    View →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
