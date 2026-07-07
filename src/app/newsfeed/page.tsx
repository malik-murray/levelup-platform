'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { formatLocalDate } from '@/lib/newsfeed/dateRange';
import { rankArticlesForBriefing } from '@/lib/newsfeed/topStoriesRanking';
import { getSummaryParagraph, type ArticleSummaryView } from '@/lib/newsfeed/articlePresentation';
import { normalizeUserFeedContext, type UserFeedContext } from '@/lib/newsfeed/userFeedContext';

type Source = {
    id: string;
    name: string;
    display_name: string;
};

type Topic = {
    id: string;
    name: string;
    display_name: string;
    description?: string | null;
};

type Article = {
    id: string;
    title: string;
    url: string;
    publish_time: string;
    description: string | null;
    image_url: string | null;
    topic_ids: string[];
    source: Source;
    summary: ArticleSummaryView | null;
    user_action: {
        is_saved: boolean;
        is_archived: boolean;
        preferred_summary_length: number;
    };
};

type Filter = 'feed' | 'saved' | 'archived';
type CategoryKey = 'for-you' | 'top' | 'federal' | 'dmv' | 'tech' | 'business' | 'finance';

const SECTION_DEFINITIONS = [
    { key: 'federal', title: 'Federal Workforce', topicNames: ['fed_gov', 'federal_workforce'] },
    { key: 'dmv', title: 'DMV', topicNames: ['dmv'] },
    { key: 'tech', title: 'Tech', topicNames: ['tech', 'ai', 'software', 'hardware', 'startups', 'security'] },
    { key: 'business', title: 'Business', topicNames: ['business', 'economy'] },
    { key: 'finance', title: 'Finance', topicNames: ['finance', 'stocks', 'crypto_markets', 'real_estate'] },
] as const;

const PERSONAL_PRIORITY_TOPIC_NAMES = ['fed_gov', 'federal_workforce', 'dmv', 'tech', 'business', 'finance'];

const CATEGORY_TABS: Array<{ key: CategoryKey; label: string }> = [
    { key: 'for-you', label: 'For You' },
    { key: 'top', label: 'Top Stories' },
    { key: 'business', label: 'Business' },
    { key: 'tech', label: 'Tech' },
    { key: 'finance', label: 'Finance' },
    { key: 'federal', label: 'Federal' },
    { key: 'dmv', label: 'DMV' },
];

const MARKET_INDICES = [
    { name: 'S&P 500', value: '5,278.20', change: '+1.24%' },
    { name: 'Nasdaq', value: '16,735.02', change: '+1.68%' },
    { name: 'Dow Jones', value: '38,872.10', change: '+0.91%' },
];

export default function NewsfeedPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filter, setFilter] = useState<Filter>('feed');
    const [hasPreferences, setHasPreferences] = useState<boolean | null>(null);
    const [preferencesLoading, setPreferencesLoading] = useState(true);
    const [sources, setSources] = useState<Source[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedSourceFilter, setSelectedSourceFilter] = useState<string | null>(null);
    const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>('for-you');
    const [ingestTriggered, setIngestTriggered] = useState(false);
    const [userFeedContext, setUserFeedContext] = useState<UserFeedContext | null>(null);

    useEffect(() => {
        checkPreferences();
        loadSources();
        loadTopics();
        loadUserContext();
    }, []);

    const loadUserContext = async () => {
        try {
            const response = await fetch('/api/newsfeed/context');
            const data = await response.json();
            setUserFeedContext(normalizeUserFeedContext(data.context));
        } catch (error) {
            console.error('Error loading user context:', error);
        }
    };

    const triggerIngestion = useCallback(async () => {
        try {
            await fetch('/api/newsfeed/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({}),
            });
            setIngestTriggered(true);
        } catch (error) {
            console.error('Error triggering newsfeed ingestion:', error);
        }
    }, []);

    useEffect(() => {
        if (hasPreferences) {
            void triggerIngestion();
        }
    }, [hasPreferences, triggerIngestion]);

    const checkPreferences = async () => {
        try {
            setPreferencesLoading(true);
            const response = await fetch('/api/newsfeed/preferences');
            const data = await response.json();
            const prefs = data.preferences;
            if (prefs && (prefs.selected_source_ids?.length > 0 || prefs.selected_topic_ids?.length > 0)) {
                setHasPreferences(true);
            } else {
                setHasPreferences(false);
            }
        } catch (error) {
            console.error('Error checking preferences:', error);
            setHasPreferences(false);
        } finally {
            setPreferencesLoading(false);
        }
    };

    const loadSources = async () => {
        try {
            const response = await fetch('/api/newsfeed/sources');
            const data = await response.json();
            setSources(data.sources || []);
        } catch (error) {
            console.error('Error loading sources:', error);
        }
    };

    const loadTopics = async () => {
        try {
            const response = await fetch('/api/newsfeed/topics');
            const data = await response.json();
            setTopics(data.topics || []);
        } catch (error) {
            console.error('Error loading topics:', error);
        }
    };

    const loadArticles = useCallback(async () => {
        try {
            setLoading(true);
            const dateStr = formatLocalDate(currentDate);
            let url = `/api/newsfeed/articles?date=${dateStr}&filter=${filter}`;
            if (selectedSourceFilter) {
                url += `&sourceId=${selectedSourceFilter}`;
            }
            if (selectedTopicFilter) {
                url += `&topicId=${selectedTopicFilter}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            setArticles(data.articles || []);
            
            // Check if many articles are uncategorized and offer to update
            const uncategorizedCount = (data.articles || []).filter((a: Article) => 
                !a.topic_ids || a.topic_ids.length === 0
            ).length;
            
            if (uncategorizedCount > 0 && uncategorizedCount > (data.articles?.length || 0) * 0.3) {
                console.log(`⚠️  ${uncategorizedCount} articles are uncategorized. Consider updating topics.`);
            }
        } catch (error) {
            console.error('Error loading articles:', error);
        } finally {
            setLoading(false);
        }
    }, [currentDate, filter, selectedSourceFilter, selectedTopicFilter]);

    useEffect(() => {
        loadArticles();
    }, [loadArticles]);

    const refreshFeed = async () => {
        try {
            setLoading(true);
            await fetch('/api/newsfeed/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ force: true }),
            });
            await loadArticles();
        } catch (error) {
            console.error('Error refreshing feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (direction === 'prev') {
            newDate.setDate(newDate.getDate() - 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
            // Don't allow future dates
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (newDate > today) return;
        }
        setCurrentDate(newDate);
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
        }
    };

    const updateArticleAction = async (articleId: string, updates: Partial<Article['user_action']>) => {
        try {
            await fetch(`/api/newsfeed/articles/${articleId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            // Reload articles to get updated state
            loadArticles();
        } catch (error) {
            console.error('Error updating article action:', error);
        }
    };

    const handleSaveToggle = (article: Article) => {
        updateArticleAction(article.id, { is_saved: !article.user_action.is_saved });
    };

    const handleArchiveToggle = (article: Article) => {
        updateArticleAction(article.id, { is_archived: !article.user_action.is_archived });
    };

    const getSummaryText = (summary: ArticleSummaryView | null, length: number, description?: string | null): string => {
        return getSummaryParagraph(summary, length, description);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Note: Filtering is now done server-side via API query params
    // This client-side filter is a backup, but the API should handle it
    const expandedTopicFilterIds = useMemo(() => {
        if (!selectedTopicFilter) return null;
        const selectedTopicName = topics.find((topic) => topic.id === selectedTopicFilter)?.name;
        if (selectedTopicName === 'federal_workforce' || selectedTopicName === 'fed_gov') {
            return topics
                .filter((topic) => topic.name === 'federal_workforce' || topic.name === 'fed_gov')
                .map((topic) => topic.id);
        }
        return [selectedTopicFilter];
    }, [selectedTopicFilter, topics]);

    const filteredArticles = articles.filter(article => {
        // Double-check filters on client side (backup)
        if (selectedSourceFilter && article.source.id !== selectedSourceFilter) {
            return false;
        }
        if (selectedTopicFilter) {
            const allowedTopicIds = expandedTopicFilterIds || [selectedTopicFilter];
            if (!article.topic_ids || !allowedTopicIds.some((topicId) => article.topic_ids.includes(topicId))) {
                return false;
            }
        }
        return true;
    });

    function renderArticleCard(article: Article, compact = false) {
        const preferredLength = article.user_action.preferred_summary_length || 1;
        const summaryText =
            getSummaryText(article.summary, preferredLength, article.description) || '';
        const sourceText = article.source.display_name || 'Source';
        const saveLabel = article.user_action.is_saved ? 'Unsave article' : 'Save article';
        const displaySummary = compact ? summaryText : summaryText;

        return (
            <article
                key={article.id}
                className={`group rounded-2xl border border-white/10 bg-[#12172A] p-3 ${compact ? '' : 'space-y-3'}`}
            >
                <div className="min-w-0 space-y-2">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm font-semibold leading-snug text-slate-100 hover:text-amber-300"
                        title={article.title}
                    >
                        {article.title}
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="truncate">{sourceText}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(article.publish_time)}</span>
                    </div>
                    {displaySummary ? (
                        <p className="text-xs leading-relaxed text-slate-300">{displaySummary}</p>
                    ) : null}
                    {!compact && article.summary?.why_it_matters ? (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                            Why it matters: {article.summary.why_it_matters}
                        </p>
                    ) : null}
                    {!compact && article.summary?.action_suggestion ? (
                        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-200">
                            Suggested action: {article.summary.action_suggestion}
                        </p>
                    ) : null}
                    {compact && article.summary?.why_it_matters ? (
                        <p className="text-[11px] leading-relaxed text-amber-100/90 line-clamp-2">
                            {article.summary.why_it_matters}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                        onClick={() => handleSaveToggle(article)}
                        aria-label={saveLabel}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                            article.user_action.is_saved
                                ? 'border-amber-400/40 bg-amber-500/20 text-amber-200'
                                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        {article.user_action.is_saved ? 'Saved' : 'Save'}
                    </button>
                    <button
                        onClick={() => handleArchiveToggle(article)}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                            article.user_action.is_archived
                                ? 'border-white/25 bg-white/20 text-slate-200'
                                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        Archive
                    </button>
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-white/15 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10 hover:text-amber-200"
                    >
                        Open
                    </a>
                </div>
            </article>
        );
    }

    // Show loading state while checking preferences
    if (preferencesLoading || hasPreferences === null) {
        return (
            <main className="min-h-screen bg-[#070B17] text-slate-100">
                <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-5">
                    <p className="text-sm text-slate-400">Loading your feed...</p>
                </div>
            </main>
        );
    }

    // Show setup screen if no preferences are set
    if (hasPreferences === false) {
        return (
            <main className="min-h-screen bg-[#070B17] text-slate-100">
                <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 text-center">
                    <h2 className="mb-4 text-2xl font-bold">Set up your news feed</h2>
                    <p className="mb-6 text-sm text-slate-400">
                        Select your news sources and topics to personalize your feed
                    </p>
                    <Link
                        href="/newsfeed/settings"
                        className="inline-block rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-400"
                    >
                        Set Up Preferences
                    </Link>
                </div>
            </main>
        );
    }

    const topicIdToName = new Map(topics.map((topic) => [topic.id, topic.name]));
    const { rankedArticles, topStories } = rankArticlesForBriefing(filteredArticles, topicIdToName, {
        topStoriesCount: 5,
        maxPerSource: 2,
    }, userFeedContext);
    const topStoryIds = new Set(topStories.map((article) => article.id));

    const sectionedArticles = SECTION_DEFINITIONS.map((section) => {
        const sectionTopicNames = new Set<string>([...section.topicNames]);
        const items = rankedArticles.filter((article) => {
            if (topStoryIds.has(article.id)) {
                return false;
            }

            return article.topic_ids.some((topicId) => {
                const n = topicIdToName.get(topicId);
                return n != null && sectionTopicNames.has(n);
            });
        });

        return { ...section, items: items.slice(0, 8) };
    }).filter((section) => section.items.length > 0);

    sectionedArticles.sort((a, b) => {
        const aNames = new Set<string>([...a.topicNames]);
        const bNames = new Set<string>([...b.topicNames]);
        const aPriority = PERSONAL_PRIORITY_TOPIC_NAMES.findIndex((topicName) => aNames.has(topicName));
        const bPriority = PERSONAL_PRIORITY_TOPIC_NAMES.findIndex((topicName) => bNames.has(topicName));
        const normalizedA = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
        const normalizedB = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;
        return normalizedA - normalizedB;
    });

    const selectedSection = sectionedArticles.find((section) => section.key === activeCategory);
    const feedPool =
        activeCategory === 'for-you'
            ? rankedArticles
            : activeCategory === 'top'
                ? topStories
                : selectedSection?.items || [];

    const heroStory = feedPool[0] || topStories[0] || rankedArticles[0] || null;
    const compactStories = (feedPool.length > 1 ? feedPool.slice(1) : rankedArticles.slice(1)).slice(0, 5);
    const feedTitle =
        activeCategory === 'for-you'
            ? 'Top For You'
            : activeCategory === 'top'
                ? 'Top Stories'
                : `${CATEGORY_TABS.find((tab) => tab.key === activeCategory)?.label || 'Category'} Highlights`;

    return (
        <main className="min-h-screen bg-[#070B17] text-slate-100">
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-[#0A1022] via-[#0A0F1F] to-[#060A15] pb-20">
                <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070B17]/95 px-4 pb-3 pt-5 backdrop-blur">
                    <div className="mb-3 flex items-center justify-between">
                        <button
                            type="button"
                            className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                            aria-label="Open menu"
                            onClick={() => setSidebarOpen(true)}
                        >
                            ☰
                        </button>
                        <h1 className="text-lg font-semibold text-slate-100">News</h1>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/newsfeed/settings"
                                className="rounded-lg border border-amber-400/30 bg-amber-500/20 px-2 py-1 text-[11px] text-amber-200"
                            >
                                Settings
                            </Link>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold">
                                LU
                            </div>
                        </div>
                    </div>

                    <div className="no-scrollbar flex gap-5 overflow-x-auto pb-1 text-sm">
                        {CATEGORY_TABS.map((tab) => {
                            const active = activeCategory === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveCategory(tab.key)}
                                    className={`whitespace-nowrap border-b-2 pb-2 transition-colors ${
                                        active ? 'border-amber-500 text-amber-300' : 'border-transparent text-slate-400'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </header>

                <div className="space-y-4 px-3 py-4">
                    <div className="flex items-center justify-between text-xs">
                        <button
                            onClick={() => navigateDate('prev')}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300"
                        >
                            ← Previous
                        </button>
                        <span className="font-medium text-slate-300">{formatDate(currentDate)}</span>
                        <button
                            onClick={() => navigateDate('next')}
                            disabled={currentDate.toDateString() === new Date().toDateString()}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={selectedSourceFilter || ''}
                            onChange={(e) => setSelectedSourceFilter(e.target.value || null)}
                            className="w-1/2 rounded-lg border border-white/10 bg-[#10172B] px-2.5 py-2 text-xs text-slate-200"
                        >
                            <option value="">All sources</option>
                            {sources.map((source) => (
                                <option key={source.id} value={source.id}>
                                    {source.display_name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedTopicFilter || ''}
                            onChange={(e) => setSelectedTopicFilter(e.target.value || null)}
                            className="w-1/2 rounded-lg border border-white/10 bg-[#10172B] px-2.5 py-2 text-xs text-slate-200"
                        >
                            <option value="">All topics</option>
                            {topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.display_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2 rounded-xl border border-white/10 bg-[#10172B] p-1">
                        {(['feed', 'saved', 'archived'] as Filter[]).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setFilter(mode)}
                                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize ${
                                    filter === mode ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    {ingestTriggered && filteredArticles.length === 0 && !loading ? (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
                            Fetching the latest articles. This may take a minute — try Refresh shortly.
                        </div>
                    ) : null}

                    {loading ? (
                        <div className="py-10 text-center text-sm text-slate-400">Loading articles...</div>
                    ) : filteredArticles.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-[#12172A] px-4 py-8 text-center text-sm text-slate-400">
                            <p>No articles found for this view.</p>
                            <button
                                type="button"
                                onClick={refreshFeed}
                                className="mt-4 inline-block text-amber-300 hover:text-amber-200"
                            >
                                Refresh feed
                            </button>
                            <Link href="/newsfeed/settings" className="mt-2 block text-amber-300 hover:text-amber-200">
                                Update preferences
                            </Link>
                        </div>
                    ) : (
                        <>
                            {heroStory ? (
                                <section className="rounded-2xl border border-white/10 bg-[#10172B] p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h2 className="text-base font-semibold text-slate-100">{feedTitle}</h2>
                                        <button
                                            onClick={refreshFeed}
                                            disabled={loading}
                                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-slate-300"
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                    {renderArticleCard(heroStory)}
                                </section>
                            ) : null}

                            {compactStories.length > 0 ? (
                                <section className="rounded-2xl border border-white/10 bg-[#10172B] p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-base font-semibold text-slate-100">Top Business News</h3>
                                        <button
                                            type="button"
                                            onClick={() => setActiveCategory('top')}
                                            className="text-xs text-amber-300 hover:text-amber-200"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="space-y-2.5">
                                        {compactStories.map((article) => renderArticleCard(article, true))}
                                    </div>
                                </section>
                            ) : null}

                            <section className="rounded-2xl border border-white/10 bg-[#10172B] p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-slate-100">Market Snapshot</h3>
                                    <span className="text-xs text-amber-300">Live</span>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-[#0D1325] p-3">
                                    {MARKET_INDICES.map((index) => (
                                        <div key={index.name} className="flex items-center justify-between border-b border-white/5 py-2 last:border-b-0">
                                            <div>
                                                <p className="text-sm text-slate-200">{index.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-slate-100">{index.value}</p>
                                                <p className="text-xs text-emerald-400">{index.change}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>

                <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-white/10 bg-[#070B17]/95 px-3 py-2 text-[11px] text-slate-400 backdrop-blur">
                    <Link href="/" className="rounded-md px-2 py-1 hover:text-slate-200">Home</Link>
                    <Link href="/dashboard" className="rounded-md px-2 py-1 hover:text-slate-200">Dashboard</Link>
                    <button type="button" className="rounded-md px-2 py-1 text-amber-300">News</button>
                    <button type="button" onClick={() => setFilter('saved')} className="rounded-md px-2 py-1 hover:text-slate-200">Saved</button>
                    <button type="button" onClick={() => setSelectedTopicFilter(null)} className="rounded-md px-2 py-1 hover:text-slate-200">Search</button>
                </nav>
            </div>
        </main>
    );
}
