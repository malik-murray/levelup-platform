'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Article = {
    id: string;
    title: string;
    url: string;
    publish_time: string;
    summary: {
        paragraphs_1?: string;
        paragraphs_2?: string;
        paragraphs_3?: string;
        why_it_matters?: string;
    } | null;
    user_action: {
        is_saved: boolean;
        is_archived: boolean;
        preferred_summary_length: number;
    };
};

export default function NewsfeedSection({
    selectedDate,
    timeframe,
    userId,
}: {
    selectedDate: Date;
    timeframe: 'daily' | 'weekly' | 'custom';
    userId: string | null;
}) {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadArticles();
        }
    }, [selectedDate, timeframe, userId]);

    const loadArticles = async () => {
        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const response = await fetch(`/api/newsfeed/articles?date=${dateStr}&filter=feed`);
            const data = await response.json();
            setArticles(data.articles || []);
        } catch (error) {
            console.error('Error loading articles:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSummaryText = (summary: Article['summary'], length: number): string => {
        if (!summary) return '';
        const key = `paragraphs_${length}` as keyof typeof summary;
        return (summary[key] as string) || summary.paragraphs_1 || '';
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
                <div className="text-center py-8 text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Link href="/newsfeed" className="hover:underline">
                    <h2 className="text-2xl font-bold">Newsfeed</h2>
                </Link>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-4">
                {articles.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No articles for today</p>
                ) : (
                    articles.slice(0, 5).map((article) => (
                        <div key={article.id} className="border-b border-slate-700 pb-4 last:border-b-0 last:pb-0">
                            <h3 className="font-semibold text-white mb-2 line-clamp-2">{article.title}</h3>
                            {article.summary && (
                                <p className="text-sm text-slate-300 mb-2 line-clamp-3">
                                    {getSummaryText(article.summary, article.user_action.preferred_summary_length || 1)}
                                </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{new Date(article.publish_time).toLocaleDateString()}</span>
                                {article.user_action.is_saved && (
                                    <span className="text-amber-400">★ Saved</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="text-center">
                <Link
                    href="/newsfeed"
                    className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
                >
                    <span>View full Newsfeed</span>
                    <span>→</span>
                </Link>
            </div>
        </div>
    );
}
