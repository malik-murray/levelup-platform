'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type Summary = {
    id: string;
    title: string;
    category: string;
    sourceText: string;
    summary: string;
    whyItMatters?: string;
    createdAt: string;
};

export default function NewsfeedPage() {
    const [summaries, setSummaries] = useState<Summary[]>([
        {
            id: '1',
            title: 'AI Advances in Healthcare',
            category: 'Tech',
            sourceText: 'Recent developments in AI are transforming healthcare...',
            summary: '• AI is being used to diagnose diseases faster\n• New models can predict patient outcomes\n• Regulatory frameworks are evolving',
            whyItMatters: 'This could significantly reduce healthcare costs and improve patient outcomes globally.',
            createdAt: new Date().toLocaleDateString(),
        },
        {
            id: '2',
            title: 'Market Volatility Concerns',
            category: 'Finance',
            sourceText: 'Financial markets are experiencing increased volatility...',
            summary: '• Federal Reserve signals policy changes\n• Cryptocurrency markets show mixed signals\n• Investors seeking safe havens',
            whyItMatters: 'Understanding market trends helps with personal financial planning and investment decisions.',
            createdAt: new Date(Date.now() - 86400000).toLocaleDateString(),
        },
    ]);

    const [sourceText, setSourceText] = useState('');
    const [category, setCategory] = useState('World');
    const [title, setTitle] = useState('');

    const categories = ['World', 'Finance', 'Tech', 'Personal Development', 'Health', 'Spiritual'];

    const handleSummarize = () => {
        if (!sourceText.trim()) return;

        // Mock AI-generated summary (stub for now)
        const mockSummary = '• Key point 1 extracted from source\n• Key point 2 extracted from source\n• Key point 3 extracted from source\n• Key point 4 extracted from source\n• Key point 5 extracted from source';
        const mockWhyItMatters = 'This summary highlights important trends and implications for your personal growth and decision-making.';
        const generatedTitle = title.trim() || 'Generated Summary ' + summaries.length + 1;

        const newSummary: Summary = {
            id: Date.now().toString(),
            title: generatedTitle,
            category,
            sourceText: sourceText.trim(),
            summary: mockSummary,
            whyItMatters: mockWhyItMatters,
            createdAt: new Date().toLocaleDateString(),
        };

        setSummaries(prev => [newSummary, ...prev]);
        setSourceText('');
        setTitle('');
        setCategory('World');
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
                            <h1 className="text-xl font-semibold text-amber-400">Newsfeed Summarizer</h1>
                            <p className="text-xs text-slate-400 mt-0.5">The Daily Edge</p>
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
            <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
                {/* New Summary Form */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">New Summary</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Title (optional)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Give this summary a title..."
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Source Text</label>
                            <textarea
                                value={sourceText}
                                onChange={e => setSourceText(e.target.value)}
                                placeholder="Paste article, thread, newsletter, or any text you want summarized..."
                                className="w-full h-64 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                            />
                        </div>
                        <button
                            onClick={handleSummarize}
                            disabled={!sourceText.trim()}
                            className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Summarize
                        </button>
                    </div>
                </div>

                {/* Past Summaries */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Past Summaries</h2>
                    <div className="space-y-6">
                        {summaries.map(summary => (
                            <div key={summary.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-base font-semibold text-white mb-1">{summary.title}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-amber-900/30 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300">
                                                {summary.category}
                                            </span>
                                            <span className="text-xs text-slate-400">{summary.createdAt}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <h4 className="text-xs font-semibold text-amber-400 mb-2">Summary</h4>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{summary.summary}</p>
                                </div>
                                {summary.whyItMatters && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-purple-400 mb-2">Why This Matters</h4>
                                        <p className="text-sm text-slate-300">{summary.whyItMatters}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
