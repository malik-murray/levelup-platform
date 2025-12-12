'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@auth/supabaseClient';

type EmotionalTraits = {
    primary_traits: string[];
    strengths: string[];
    growth_areas: string[];
    coping_style: string;
    emotional_expression: string;
};

type TestResult = {
    summary: string;
    emotionalTraits: EmotionalTraits;
    resolutions: string;
};

function EmotionalTestResultsContent() {
    const searchParams = useSearchParams();
    const testId = searchParams.get('testId');
    
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<TestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (testId) {
            loadResults();
        } else {
            setError('Test ID is required');
            setLoading(false);
        }
    }, [testId]);

    const loadResults = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = '/login';
                return;
            }

            // First, try to get existing results from database
            const { data: existingResults, error: fetchError } = await supabase
                .from('emotional_test_results')
                .select('summary, emotional_traits, resolutions')
                .eq('test_id', testId!)
                .eq('user_id', session.user.id)
                .single();

            if (existingResults && !fetchError) {
                setResult({
                    summary: existingResults.summary,
                    emotionalTraits: existingResults.emotional_traits as EmotionalTraits,
                    resolutions: existingResults.resolutions,
                });
                setLoading(false);
                return;
            }

            // If no results exist, generate them
            const response = await fetch('/api/emotions/test/generate-summary', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ testId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate summary');
            }

            const data = await response.json();
            setResult({
                summary: data.summary,
                emotionalTraits: data.emotionalTraits,
                resolutions: data.resolutions,
            });
        } catch (err) {
            console.error('Error loading results:', err);
            setError(err instanceof Error ? err.message : 'Failed to load results');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-slate-400">Generating your personalized summary...</p>
                </div>
            </main>
        );
    }

    if (error || !result) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error || 'Failed to load results'}</p>
                        <Link
                            href="/emotions"
                            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 inline-block"
                        >
                            Back to Emotional Tracker
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/emotions" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Your Emotional Assessment Results</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Personalized insights and guidance</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/emotions"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Back
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
                {/* Summary Section */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-amber-400">Your Emotional Profile</h2>
                    <div className="prose prose-invert max-w-none">
                        <p className="text-slate-200 whitespace-pre-line leading-relaxed">{result.summary}</p>
                    </div>
                </div>

                {/* Emotional Traits */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-amber-400">Key Emotional Traits</h2>
                    
                    <div className="space-y-4">
                        {/* Primary Traits */}
                        {result.emotionalTraits.primary_traits && result.emotionalTraits.primary_traits.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2">Primary Traits</h3>
                                <div className="flex flex-wrap gap-2">
                                    {result.emotionalTraits.primary_traits.map((trait, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center rounded-full bg-amber-900/30 border border-amber-500/30 px-3 py-1 text-sm text-amber-300"
                                        >
                                            {trait}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Strengths */}
                        {result.emotionalTraits.strengths && result.emotionalTraits.strengths.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2">Strengths</h3>
                                <div className="flex flex-wrap gap-2">
                                    {result.emotionalTraits.strengths.map((strength, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center rounded-full bg-emerald-900/30 border border-emerald-500/30 px-3 py-1 text-sm text-emerald-300"
                                        >
                                            {strength}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Growth Areas */}
                        {result.emotionalTraits.growth_areas && result.emotionalTraits.growth_areas.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2">Areas for Growth</h3>
                                <div className="flex flex-wrap gap-2">
                                    {result.emotionalTraits.growth_areas.map((area, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center rounded-full bg-blue-900/30 border border-blue-500/30 px-3 py-1 text-sm text-blue-300"
                                        >
                                            {area}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Coping Style */}
                        {result.emotionalTraits.coping_style && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2">Coping Style</h3>
                                <p className="text-slate-200 text-sm">{result.emotionalTraits.coping_style}</p>
                            </div>
                        )}

                        {/* Emotional Expression */}
                        {result.emotionalTraits.emotional_expression && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2">Emotional Expression</h3>
                                <p className="text-slate-200 text-sm">{result.emotionalTraits.emotional_expression}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Resolutions */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-amber-400">Personalized Resolutions & Tips</h2>
                    <div className="prose prose-invert max-w-none">
                        <p className="text-slate-200 whitespace-pre-line leading-relaxed">{result.resolutions}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4 pt-4">
                    <Link
                        href="/emotions"
                        className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                        Back to Emotional Tracker
                    </Link>
                    <Link
                        href="/emotions/test"
                        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
                    >
                        Take Test Again
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function EmotionalTestResultsPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-slate-400">Loading...</p>
                </div>
            </main>
        }>
            <EmotionalTestResultsContent />
        </Suspense>
    );
}

