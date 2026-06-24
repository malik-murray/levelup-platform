'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatLocalDate, isSameLocalCalendarDay } from '@/lib/newsfeed/dateRange';
import { getSummaryParagraph, type ArticleSummaryView } from '@/lib/newsfeed/articlePresentation';
import DashboardCollapsibleSection from './DashboardCollapsibleSection';

const POLL_INTERVAL_MS = 30_000;
const POLL_DURATION_MS = 120_000;

function formatTimeAgo(publishTime: string): string {
    const ageMs = Date.now() - new Date(publishTime).getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    if (ageMinutes < 1) return 'Just now';
    if (ageMinutes < 60) return `${ageMinutes}m ago`;
    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) return `${ageHours}h ago`;
    return new Date(publishTime).toLocaleDateString();
}

function formatUpdatedAgo(updatedAt: Date | null): string {
    if (!updatedAt) return '';
    const ageMinutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
    if (ageMinutes < 1) return 'Updated just now';
    return `Updated ${ageMinutes}m ago`;
}

type Article = {
    id: string;
    title: string;
    url: string;
    publish_time: string;
    description?: string | null;
    image_url?: string | null;
    source?: {
        display_name?: string;
    };
    summary: ArticleSummaryView | null;
    user_action: {
        is_saved: boolean;
        is_archived: boolean;
        preferred_summary_length: number;
    };
};

function applyArticleAction(
    articles: Article[],
    articleId: string,
    updates: Partial<Article['user_action']>,
): Article[] {
    return articles.map((article) =>
        article.id === articleId
            ? { ...article, user_action: { ...article.user_action, ...updates } }
            : article,
    );
}

function ArticleCard({
    article,
    onSaveToggle,
    onArchiveToggle,
}: {
    article: Article;
    onSaveToggle: (article: Article) => void;
    onArchiveToggle: (article: Article) => void;
}) {
    const summaryText = getSummaryParagraph(
        article.summary,
        article.user_action.preferred_summary_length || 1,
        article.description,
    );

    return (
        <div className="border-b border-[#ff9d00]/20 pb-4 last:border-b-0 last:pb-0">
            <div className="flex gap-3">
                {article.image_url ? (
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                    >
                        <img
                            src={article.image_url}
                            alt=""
                            className="h-16 w-16 rounded-lg border border-[#ff9d00]/20 object-cover"
                            onError={(event) => {
                                event.currentTarget.parentElement?.remove();
                            }}
                        />
                    </a>
                ) : null}
                <div className="min-w-0 flex-1 space-y-2">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 block font-semibold text-white hover:text-[#ffe066]"
                    >
                        {article.title}
                    </a>
                    {summaryText ? (
                        <p className="line-clamp-2 text-sm text-slate-300">{summaryText}</p>
                    ) : null}
                    {article.summary?.why_it_matters ? (
                        <p className="line-clamp-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-2 text-xs text-violet-200">
                            {article.summary.why_it_matters}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {article.source?.display_name ? <span>{article.source.display_name}</span> : null}
                        <span>{formatTimeAgo(article.publish_time)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onSaveToggle(article)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                article.user_action.is_saved
                                    ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                                    : 'border-[#ff9d00]/25 bg-black/20 text-slate-300 hover:text-[#ffe066]'
                            }`}
                        >
                            {article.user_action.is_saved ? 'Saved' : 'Save'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onArchiveToggle(article)}
                            className="rounded-md border border-[#ff9d00]/25 bg-black/20 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-[#ffe066]"
                        >
                            Archive
                        </button>
                        <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-[#ff9d00]/25 bg-black/20 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-[#ffe066]"
                        >
                            Open
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NewsfeedSection({
    selectedDate,
    timeframe,
    userId,
}: {
    selectedDate: Date;
    timeframe: 'daily' | 'weekly' | 'custom';
    userId: string | null;
}) {
    const [globalArticles, setGlobalArticles] = useState<Article[]>([]);
    const [personalArticles, setPersonalArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);

    const isToday = isSameLocalCalendarDay(selectedDate, new Date());

    const loadArticles = useCallback(
        async (silent = false) => {
            if (!userId || !isToday) return;

            if (!silent) {
                setLoading(true);
            }

            try {
                const dateStr = formatLocalDate(selectedDate);
                const [globalRes, personalRes] = await Promise.all([
                    fetch(`/api/newsfeed/articles?date=${dateStr}&filter=feed&scope=global`),
                    fetch(`/api/newsfeed/articles?date=${dateStr}&filter=feed&scope=personal`),
                ]);

                const [globalData, personalData] = await Promise.all([
                    globalRes.json(),
                    personalRes.json(),
                ]);

                setGlobalArticles(globalData.articles || []);
                setPersonalArticles(personalData.articles || []);
                setLastUpdatedAt(new Date());
            } catch (error) {
                console.error('Error loading articles:', error);
            } finally {
                if (!silent) {
                    setLoading(false);
                }
            }
        },
        [userId, selectedDate, isToday],
    );

    useEffect(() => {
        if (!userId || !isToday) {
            setLoading(false);
            return;
        }

        void loadArticles();

        const interval = window.setInterval(() => {
            void loadArticles(true);
        }, POLL_INTERVAL_MS);

        const stopPolling = window.setTimeout(() => {
            window.clearInterval(interval);
        }, POLL_DURATION_MS);

        return () => {
            window.clearInterval(interval);
            window.clearTimeout(stopPolling);
        };
    }, [userId, selectedDate, timeframe, isToday, loadArticles]);

    useEffect(() => {
        if (!lastUpdatedAt) return;
        const timer = window.setInterval(() => setRefreshTick((tick) => tick + 1), 60_000);
        return () => window.clearInterval(timer);
    }, [lastUpdatedAt]);

    const updateArticleAction = async (articleId: string, updates: Partial<Article['user_action']>) => {
        setGlobalArticles((current) => applyArticleAction(current, articleId, updates));
        setPersonalArticles((current) => applyArticleAction(current, articleId, updates));

        try {
            await fetch(`/api/newsfeed/articles/${articleId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (error) {
            console.error('Error updating article action:', error);
            void loadArticles(true);
        }
    };

    const handleSaveToggle = (article: Article) => {
        void updateArticleAction(article.id, { is_saved: !article.user_action.is_saved });
    };

    const handleArchiveToggle = (article: Article) => {
        const willArchive = !article.user_action.is_archived;
        void updateArticleAction(article.id, { is_archived: willArchive });
        if (willArchive) {
            setGlobalArticles((current) => current.filter((item) => item.id !== article.id));
            setPersonalArticles((current) => current.filter((item) => item.id !== article.id));
        }
    };

    if (!isToday) {
        return null;
    }

    const globalTop = globalArticles.slice(0, 3);
    const personalTop = personalArticles.slice(0, 2);
    const updatedLabel = formatUpdatedAgo(lastUpdatedAt);
    void refreshTick;

    return (
        <DashboardCollapsibleSection
            title="Today's News"
            open={open}
            onToggle={() => setOpen((o) => !o)}
            headingSize="md"
            trailing={updatedLabel ? <span className="text-xs text-slate-500">{updatedLabel}</span> : undefined}
        >
            <div className="space-y-5 p-4">
                {loading ? (
                    <div className="py-8 text-center text-slate-400">Loading news...</div>
                ) : (
                    <>
                        <div>
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#ffcc66]">
                                Trending Globally
                            </h3>
                            {globalTop.length === 0 ? (
                                <p className="py-2 text-center text-sm text-slate-400">No global stories for today</p>
                            ) : (
                                <div className="space-y-4">
                                    {globalTop.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                            onSaveToggle={handleSaveToggle}
                                            onArchiveToggle={handleArchiveToggle}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {personalTop.length > 0 ? (
                            <div className="border-t border-[#ff9d00]/20 pt-4">
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#ffcc66]">
                                    For You
                                </h3>
                                <div className="space-y-4">
                                    {personalTop.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                            onSaveToggle={handleSaveToggle}
                                            onArchiveToggle={handleArchiveToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="border-t border-[#ff9d00]/20 pt-4 text-center">
                                <p className="text-sm text-slate-400">Set up sources and About Me for a personalized feed.</p>
                                <Link
                                    href="/newsfeed/settings"
                                    className="mt-2 inline-block text-sm text-[#ffcc66] hover:text-[#ffe066]"
                                >
                                    Configure For You →
                                </Link>
                            </div>
                        )}
                    </>
                )}

                <div className="border-t border-[#ff9d00]/20 pt-3 text-center">
                    <Link
                        href="/newsfeed"
                        className="inline-flex items-center gap-2 text-[#ffcc66] transition-colors hover:text-[#ffe066]"
                    >
                        <span>View full Newsfeed</span>
                        <span>→</span>
                    </Link>
                </div>
            </div>
        </DashboardCollapsibleSection>
    );
}
