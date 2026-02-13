'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

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

type ArticleSummary = {
    paragraphs_1?: string;
    paragraphs_2?: string;
    paragraphs_3?: string;
    paragraphs_4?: string;
    paragraphs_5?: string;
    why_it_matters?: string;
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
    summary: ArticleSummary | null;
    user_action: {
        is_saved: boolean;
        is_archived: boolean;
        preferred_summary_length: number;
    };
};

type Filter = 'feed' | 'saved' | 'archived';

export default function NewsfeedPage() {
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

    useEffect(() => {
        checkPreferences();
        loadSources();
        loadTopics();
    }, []);

    useEffect(() => {
        loadArticles();
    }, [currentDate, filter, selectedSourceFilter, selectedTopicFilter]);

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

    const loadArticles = async () => {
        try {
            setLoading(true);
            const dateStr = currentDate.toISOString().split('T')[0];
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
    };

    const updateArticleTopics = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/newsfeed/update-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            console.log('Topic update result:', data);
            
            // Reload articles after update
            await loadArticles();
            
            if (data.success) {
                alert(`Successfully updated topics for ${data.updated} articles!`);
            } else {
                alert(`Error: ${data.error || 'Failed to update topics'}`);
            }
        } catch (error) {
            console.error('Error updating topics:', error);
            alert('Failed to update topics. Please try again.');
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

    const handleSummaryLengthChange = (article: Article, length: number) => {
        updateArticleAction(article.id, { preferred_summary_length: length });
    };

    const getSummaryText = (summary: ArticleSummary | null, length: number): string => {
        if (!summary) return '';
        const key = `paragraphs_${length}` as keyof ArticleSummary;
        return (summary[key] as string) || summary.paragraphs_1 || '';
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

    const getTopicName = (topicId: string): string => {
        const topic = topics.find(t => t.id === topicId);
        return topic?.display_name || topic?.name || 'Uncategorized';
    };

    // Group articles by topic
    const groupArticlesByTopic = (articles: Article[]) => {
        const grouped: Record<string, Article[]> = {};
        const uncategorized: Article[] = [];

        articles.forEach(article => {
            if (article.topic_ids && article.topic_ids.length > 0) {
                // Use the first topic for grouping
                const topicId = article.topic_ids[0];
                if (!grouped[topicId]) {
                    grouped[topicId] = [];
                }
                grouped[topicId].push(article);
            } else {
                uncategorized.push(article);
            }
        });

        return { grouped, uncategorized };
    };

    // Note: Filtering is now done server-side via API query params
    // This client-side filter is a backup, but the API should handle it
    const filteredArticles = articles.filter(article => {
        // Double-check filters on client side (backup)
        if (selectedSourceFilter && article.source.id !== selectedSourceFilter) {
            return false;
        }
        if (selectedTopicFilter && (!article.topic_ids || !article.topic_ids.includes(selectedTopicFilter))) {
            return false;
        }
        return true;
    });

    const { grouped, uncategorized } = groupArticlesByTopic(filteredArticles);
    const topicIds = Object.keys(grouped).sort((a, b) => {
        const nameA = getTopicName(a);
        const nameB = getTopicName(b);
        return nameA.localeCompare(nameB);
    });

    function renderArticleCard(article: Article) {
        const summaryLength = article.user_action.preferred_summary_length;
        const summaryText = getSummaryText(article.summary, summaryLength);

        return (
            <article
                key={article.id}
                className="rounded-lg border border-slate-800 bg-slate-950 dark:bg-slate-950 p-4 sm:p-6"
            >
                {/* Header */}
                <div className="mb-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-white flex-1">
                            {article.title}
                        </h2>
                    </div>
                    {/* Source and Topic Tags */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-400/20 text-amber-400 border border-amber-400/30">
                            {article.source.display_name}
                        </span>
                        {article.topic_ids && article.topic_ids.length > 0 && (
                            <>
                                {article.topic_ids.map(topicId => {
                                    const topic = topics.find(t => t.id === topicId);
                                    return (
                                        <span
                                            key={topicId}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-400/20 text-blue-400 border border-blue-400/30"
                                        >
                                            {topic?.display_name || topic?.name || 'Unknown'}
                                        </span>
                                    );
                                })}
                            </>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">
                            {formatTimeAgo(article.publish_time)}
                        </span>
                    </div>
                    {/* Description/Summary from RSS */}
                    {article.description && (
                        <p className="text-sm text-slate-300 leading-relaxed mb-3 line-clamp-3">
                            {article.description}
                        </p>
                    )}
                </div>

                {/* Summary Length Selector */}
                {article.summary && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-xs text-slate-400">Summary:</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((length) => (
                                    <button
                                        key={length}
                                        onClick={() => handleSummaryLengthChange(article, length)}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${
                                            summaryLength === length
                                                ? 'bg-amber-400 text-black font-semibold'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        {length}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {summaryText}
                        </p>
                    </div>
                )}

                {/* Why It Matters */}
                {article.summary?.why_it_matters && (
                    <div className="mb-4 p-3 rounded-md bg-purple-900/20 border border-purple-500/30">
                        <h4 className="text-xs font-semibold text-purple-400 mb-1">
                            Why this matters to me
                        </h4>
                        <p className="text-sm text-slate-300">
                            {article.summary.why_it_matters}
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition-colors text-center"
                    >
                        Read Full Article
                    </a>
                    <button
                        onClick={() => handleSaveToggle(article)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            article.user_action.is_saved
                                ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                    >
                        {article.user_action.is_saved ? 'Saved' : 'Save'}
                    </button>
                    <button
                        onClick={() => handleArchiveToggle(article)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            article.user_action.is_archived
                                ? 'bg-slate-700 text-slate-300 border border-slate-600'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                    >
                        Archive
                    </button>
                </div>
            </article>
        );
    }

    // Show loading state while checking preferences
    if (preferencesLoading || hasPreferences === null) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="relative h-8 w-8">
                                <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-amber-400">Newsfeed</h1>
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
                <div className="mx-auto max-w-4xl px-6 py-12 text-center">
                    <p className="text-slate-600 dark:text-slate-400">Loading...</p>
                </div>
            </main>
        );
    }

    // Show setup screen if no preferences are set
    if (hasPreferences === false) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="relative h-8 w-8">
                                <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-amber-400">Newsfeed</h1>
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

                <div className="mx-auto max-w-4xl px-6 py-12 text-center">
                    <h2 className="text-2xl font-bold mb-4">Get Started</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        Select your news sources and topics to personalize your feed
                    </p>
                    <Link
                        href="/newsfeed/settings"
                        className="inline-block rounded-md bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
                    >
                        Set Up Preferences
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors sticky top-0 z-10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Newsfeed</h1>
                            <p className="text-xs text-slate-400 mt-0.5">The Daily Edge</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/newsfeed/settings"
                            className="rounded-md border border-slate-700 bg-slate-900 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            Settings
                        </Link>
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-700 bg-slate-900 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors hidden sm:inline-block"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6">
                {/* Source and Topic Filters */}
                <div className="mb-6 flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-400 mb-1">Filter by Source</label>
                        <select
                            value={selectedSourceFilter || ''}
                            onChange={(e) => setSelectedSourceFilter(e.target.value || null)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">All Sources</option>
                            {sources.map(source => (
                                <option key={source.id} value={source.id}>
                                    {source.display_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-400 mb-1">Filter by Topic</label>
                        <select
                            value={selectedTopicFilter || ''}
                            onChange={(e) => setSelectedTopicFilter(e.target.value || null)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">All Topics</option>
                            {topics.map(topic => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.display_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(selectedSourceFilter || selectedTopicFilter) && (
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setSelectedSourceFilter(null);
                                    setSelectedTopicFilter(null);
                                }}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-md hover:bg-slate-800 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setFilter('feed')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            filter === 'feed'
                                ? 'border-amber-400 text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Feed
                    </button>
                    <button
                        onClick={() => setFilter('saved')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            filter === 'saved'
                                ? 'border-amber-400 text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Saved
                    </button>
                    <button
                        onClick={() => setFilter('archived')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            filter === 'archived'
                                ? 'border-amber-400 text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Archived
                    </button>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigateDate('prev')}
                        className="rounded-md border border-slate-700 bg-slate-900 dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                    >
                        ← {formatDate(new Date(new Date(currentDate).setDate(currentDate.getDate() - 1)))}
                    </button>
                    <span className="text-lg font-semibold">{formatDate(currentDate)}</span>
                    <button
                        onClick={() => navigateDate('next')}
                        disabled={currentDate.toDateString() === new Date().toDateString()}
                        className="rounded-md border border-slate-700 bg-slate-900 dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {formatDate(new Date(new Date(currentDate).setDate(currentDate.getDate() + 1)))} →
                    </button>
                </div>

                {/* Articles List */}
                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading articles...</div>
                ) : filteredArticles.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="mb-4">
                            {selectedSourceFilter || selectedTopicFilter
                                ? "No articles match the selected filters."
                                : `No articles found for ${formatDate(currentDate)}`
                            }
                        </p>
                        {filter === 'feed' && (
                            <Link
                                href="/newsfeed/settings"
                                className="inline-block mt-4 rounded-md bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
                            >
                                Update Preferences
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Show update topics button if many articles are uncategorized */}
                        {uncategorized.length > 0 && uncategorized.length > filteredArticles.length * 0.3 && (
                            <div className="mb-6 p-4 rounded-lg border border-amber-400/30 bg-amber-400/10">
                                <p className="text-sm text-amber-300 mb-3">
                                    {uncategorized.length} articles are uncategorized. Click below to automatically assign topics based on article titles.
                                </p>
                                <button
                                    onClick={updateArticleTopics}
                                    disabled={loading}
                                    className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : 'Update Article Topics'}
                                </button>
                            </div>
                        )}
                        
                        {/* Grouped by Topic */}
                        {/* Grouped by Topic */}
                        {topicIds.map(topicId => {
                            const topicArticles = grouped[topicId];
                            if (!topicArticles || topicArticles.length === 0) return null;

                            return (
                                <div key={topicId} className="space-y-4">
                                    <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2">
                                        {getTopicName(topicId)}
                                        <span className="ml-2 text-sm font-normal text-slate-400">
                                            ({topicArticles.length} {topicArticles.length === 1 ? 'article' : 'articles'})
                                        </span>
                                    </h2>
                                    <div className="space-y-4">
                                        {topicArticles.map((article) => renderArticleCard(article))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Uncategorized Articles */}
                        {uncategorized.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2">
                                    Uncategorized
                                    <span className="ml-2 text-sm font-normal text-slate-400">
                                        ({uncategorized.length} {uncategorized.length === 1 ? 'article' : 'articles'})
                                    </span>
                                </h2>
                                <div className="space-y-4">
                                    {uncategorized.map((article) => renderArticleCard(article))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
