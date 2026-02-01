'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@auth/supabaseClient';

type Source = {
    id: string;
    name: string;
    display_name: string;
};

type Topic = {
    id: string;
    name: string;
    display_name: string;
};

type Preferences = {
    selected_source_ids: string[];
    selected_topic_ids: string[];
};

export default function NewsfeedSettingsPage() {
    const router = useRouter();
    const [sources, setSources] = useState<Source[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [preferences, setPreferences] = useState<Preferences>({
        selected_source_ids: [],
        selected_topic_ids: [],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topicSearch, setTopicSearch] = useState('');
    const [authChecked, setAuthChecked] = useState(false);

    // Filter topics based on search
    const filteredTopics = topics.filter((topic) => {
        if (!topicSearch.trim()) return true;
        const searchLower = topicSearch.toLowerCase();
        return (
            topic.display_name.toLowerCase().includes(searchLower) ||
            topic.name.toLowerCase().includes(searchLower) ||
            (topic.description && topic.description.toLowerCase().includes(searchLower))
        );
    });

    // Check authentication first
    useEffect(() => {
        checkAuth();
    }, []);

    // Load data after auth is confirmed
    useEffect(() => {
        if (authChecked) {
            loadData();
        }
    }, [authChecked]);

    const checkAuth = async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                console.warn('User not authenticated, redirecting to login');
                router.push('/login');
                return;
            }
            console.log('User authenticated:', user.id);
            setAuthChecked(true);
        } catch (error) {
            console.error('Auth check error:', error);
            router.push('/login');
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [sourcesRes, topicsRes, prefsRes] = await Promise.all([
                fetch('/api/newsfeed/sources'),
                fetch('/api/newsfeed/topics'),
                fetch('/api/newsfeed/preferences'),
            ]);

            // Check for errors
            if (!sourcesRes.ok) {
                const errorData = await sourcesRes.json().catch(() => ({}));
                console.error('Sources API error:', sourcesRes.status, errorData);
                throw new Error(`Failed to load sources: ${errorData.error || sourcesRes.statusText}`);
            }
            
            if (!topicsRes.ok) {
                const errorData = await topicsRes.json().catch(() => ({}));
                console.error('Topics API error:', topicsRes.status, errorData);
                throw new Error(`Failed to load topics: ${errorData.error || topicsRes.statusText}`);
            }

            const sourcesData = await sourcesRes.json();
            const topicsData = await topicsRes.json();
            const prefsData = await prefsRes.json();

            console.log('Loaded sources:', sourcesData.sources?.length || 0);
            console.log('Loaded topics:', topicsData.topics?.length || 0);

            setSources(sourcesData.sources || []);
            setTopics(topicsData.topics || []);
            setPreferences(prefsData.preferences || { selected_source_ids: [], selected_topic_ids: [] });
            
            if ((sourcesData.sources || []).length === 0) {
                setError('No sources found. Please run the database migration to populate sources.');
            }
            if ((topicsData.topics || []).length === 0) {
                setError('No topics found. Please run the database migration to populate topics.');
            }
        } catch (err) {
            console.error('Error loading data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load settings. Check browser console for details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        let response: Response | null = null;
        let responseText: string = '';
        let errorDetails: any = null;
        
        try {
            setSaving(true);
            setError(null);
            setSaved(false);

            // Ensure arrays are properly formatted
            const payload = {
                selected_source_ids: Array.isArray(preferences.selected_source_ids) 
                    ? preferences.selected_source_ids 
                    : [],
                selected_topic_ids: Array.isArray(preferences.selected_topic_ids) 
                    ? preferences.selected_topic_ids 
                    : [],
            };

            console.log('Saving preferences:', payload);
            
            // Verify request URL is same-origin
            const requestUrl = '/api/newsfeed/preferences';
            const fullUrl = window.location.origin + requestUrl;
            console.log('Making fetch request:', {
                relativeUrl: requestUrl,
                fullUrl: fullUrl,
                currentOrigin: window.location.origin,
                isSameOrigin: true, // Always true for relative URLs
                credentials: 'include',
            });

            // Make the fetch request
            try {
                response = await fetch(requestUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Ensure cookies are sent
                    body: JSON.stringify(payload),
                });
            } catch (networkError) {
                // Network error (no response received)
                // Build errorInfo with GUARANTEED non-empty properties
                const errorInfo = {
                    // REQUIRED: Always present, never empty
                    kind: 'NETWORK_ERROR',
                    timestamp: new Date().toISOString(),
                    requestUrl: '/api/newsfeed/preferences',
                    method: 'POST',
                    message: networkError instanceof Error ? networkError.message : 'Network request failed',
                    
                    // Error details
                    errorType: networkError?.constructor?.name || typeof networkError,
                    stack: networkError instanceof Error ? networkError.stack : null,
                    
                    // Response details (no response for network errors)
                    hasResponse: false,
                    status: null,
                    statusText: null,
                    responseText: '',
                    parsedJson: null,
                    parseError: null,
                    errorDetails: null,
                    headers: {},
                };
                
                // Log immediately with JSON.stringify to prevent mutation issues
                console.error('Save preferences - Network Error:', JSON.stringify(errorInfo, null, 2));
                console.error('Save preferences - Network Error (object):', errorInfo);
                
                setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
                setSaving(false);
                return;
            }

            // At this point, we have a response (even if it's an error response)
            const hasResponse = response !== null;
            const status = response?.status ?? null;
            const statusText = response?.statusText ?? null;
            
            // Try to read response body (can only read once, so we use text() first)
            // ALWAYS set responseText to a string, never undefined
            try {
                const text = await response.text();
                responseText = text || ''; // Ensure it's always a string
            } catch (readError) {
                responseText = `[Unable to read response body: ${readError instanceof Error ? readError.message : 'Unknown error'}]`;
            }

            // Try to parse as JSON if we got text
            let parsedJson = null;
            let parseError = null;
            if (responseText) {
                try {
                    parsedJson = JSON.parse(responseText);
                    errorDetails = parsedJson;
                } catch (parseErr) {
                    parseError = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
                    errorDetails = { rawText: responseText, parseFailed: true, parseError };
                }
            } else {
                errorDetails = { rawText: '', isEmpty: true };
            }

            // Get headers as plain object
            let headersObj: Record<string, string> = {};
            if (response) {
                try {
                    headersObj = Object.fromEntries(response.headers.entries());
                } catch (headerError) {
                    headersObj = { error: 'Unable to read headers' };
                }
            }

            if (!response || !response.ok) {
                // Build errorInfo with GUARANTEED non-empty properties
                // This is a brand new plain object that will never be empty
                const errorInfo = {
                    // REQUIRED: Always present, never empty
                    kind: 'HTTP_ERROR',
                    timestamp: new Date().toISOString(),
                    requestUrl: '/api/newsfeed/preferences',
                    method: 'POST',
                    message: 'HTTP request failed',
                    
                    // Response details (always present, even if null)
                    hasResponse: hasResponse,
                    status: status,
                    statusText: statusText || null,
                    
                    // Response body (always a string, never undefined)
                    responseText: responseText,
                    
                    // Parsed data (always present, even if null)
                    parsedJson: parsedJson,
                    parseError: parseError,
                    errorDetails: errorDetails,
                    
                    // Headers (always an object, never null)
                    headers: headersObj,
                };
                
                // Log immediately with JSON.stringify to prevent mutation issues
                console.error('Save preferences - HTTP Error:', JSON.stringify(errorInfo, null, 2));
                console.error('Save preferences - HTTP Error (object):', errorInfo);
                
                // Extract user-friendly error message from API response
                let errorMessage = 'Failed to save preferences';
                
                if (status === 401) {
                    // Use API error message and hint if available
                    errorMessage = parsedJson?.error || parsedJson?.details || 'Your session has expired. Please log in again.';
                    const hint = parsedJson?.hint || 'Please ensure you are logged in and try again.';
                    setError(`${errorMessage}. ${hint}`);
                    // DO NOT automatically redirect - let user see the error and decide
                    // DO NOT call signOut() - just show the error
                    setSaving(false);
                    return;
                } else if (status === 400) {
                    errorMessage = parsedJson?.error || parsedJson?.details || 'Invalid request. Please check your selections and try again.';
                } else if (status === 500) {
                    errorMessage = parsedJson?.error || parsedJson?.details || 'Server error. Please try again later.';
                } else if (status) {
                    // Try multiple fields from API response
                    errorMessage = parsedJson?.error || parsedJson?.details || parsedJson?.hint || responseText || `Server returned error ${status}: ${statusText || 'Unknown error'}`;
                } else {
                    errorMessage = 'Unknown error occurred. Please try again.';
                }
                
                // Show error in UI
                setError(errorMessage);
                setSaving(false);
                return;
            }

            // Success - parse the JSON response
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Save preferences - JSON Parse Error:', {
                    responseText,
                    parseError: parseError instanceof Error ? parseError.message : 'Unknown',
                });
                setError('Received invalid response from server. Please try again.');
                setSaving(false);
                return;
            }

            console.log('Preferences saved successfully:', result);
            setSaved(true);
            setError(null);

            // Redirect to feed after successful save
            setTimeout(() => {
                window.location.href = '/newsfeed';
            }, 500);
        } catch (err) {
            // Catch-all for any unexpected errors
            // Build errorInfo with GUARANTEED non-empty properties
            const errorInfo = {
                // REQUIRED: Always present, never empty
                kind: 'UNEXPECTED_ERROR',
                timestamp: new Date().toISOString(),
                requestUrl: '/api/newsfeed/preferences',
                method: 'POST',
                message: err instanceof Error ? err.message : 'Unknown error occurred',
                
                // Error details
                errorType: err?.constructor?.name || typeof err,
                stack: err instanceof Error ? err.stack : null,
                
                // Response details (if available)
                hasResponse: response !== null,
                status: response?.status ?? null,
                statusText: response?.statusText ?? null,
                responseText: responseText || '[not read]',
                errorDetails: errorDetails || null,
            };
            
            // Log immediately with JSON.stringify to prevent mutation issues
            console.error('Save preferences - Unexpected Error:', JSON.stringify(errorInfo, null, 2));
            console.error('Save preferences - Unexpected Error (object):', errorInfo);
            
            setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
            setSaving(false);
        }
    };

    const toggleSource = (sourceId: string) => {
        setPreferences((prev) => {
            const newIds = prev.selected_source_ids.includes(sourceId)
                ? prev.selected_source_ids.filter((id) => id !== sourceId)
                : [...prev.selected_source_ids, sourceId];
            return { ...prev, selected_source_ids: newIds };
        });
    };

    const toggleTopic = (topicId: string) => {
        setPreferences((prev) => {
            const newIds = prev.selected_topic_ids.includes(topicId)
                ? prev.selected_topic_ids.filter((id) => id !== topicId)
                : [...prev.selected_topic_ids, topicId];
            return { ...prev, selected_topic_ids: newIds };
        });
    };


    if (loading) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="text-center py-12">Loading...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
                    <Link href="/newsfeed" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Newsfeed Settings</h1>
                            <p className="text-xs text-slate-400 mt-0.5">The Daily Edge</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/newsfeed"
                            className="rounded-md border border-slate-700 bg-slate-900 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Feed
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
                {/* Success/Error Messages */}
                {saved && (
                    <div className="rounded-md bg-green-900/20 border border-green-500/30 px-4 py-3 text-sm text-green-400">
                        Settings saved successfully!
                    </div>
                )}
                {error && (
                    <div className="rounded-md bg-red-900/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* News Sources */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 dark:bg-slate-950 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold">News Sources</h2>
                        {preferences.selected_source_ids.length > 0 && (
                            <span className="text-xs text-amber-400">
                                {preferences.selected_source_ids.length} selected
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                        Select the news sources you want to follow. Articles from your selected sources will appear in your daily feed.
                    </p>
                    
                    {/* Select All / Deselect All buttons */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => {
                                if (preferences.selected_source_ids.length === sources.length) {
                                    // Deselect all
                                    setPreferences((prev) => ({ ...prev, selected_source_ids: [] }));
                                } else {
                                    // Select all
                                    setPreferences((prev) => ({ ...prev, selected_source_ids: sources.map(s => s.id) }));
                                }
                            }}
                            className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            {preferences.selected_source_ids.length === sources.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {/* Sources Grid */}
                    {sources.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No sources available</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {sources.map((source) => {
                                const isSelected = preferences.selected_source_ids.includes(source.id);
                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => toggleSource(source.id)}
                                        className={`p-3 rounded-md border text-sm font-medium transition-colors text-left relative ${
                                            isSelected
                                                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="absolute top-1 right-1 text-amber-400">✓</span>
                                        )}
                                        <div className="font-medium">{source.display_name}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    
                    {preferences.selected_source_ids.length === 0 && (
                        <p className="text-xs text-amber-400 mt-4 text-center">
                            ⚠️ Select at least one source to see articles in your feed
                        </p>
                    )}
                </div>

                {/* Topics */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 dark:bg-slate-950 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold">Topics</h2>
                        {preferences.selected_topic_ids.length > 0 && (
                            <span className="text-xs text-amber-400">
                                {preferences.selected_topic_ids.length} selected
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                        Select ALL topics you want to see news about. New articles matching your selected topics will appear daily in your feed.
                    </p>
                    
                    {/* Search and Select All / Deselect All buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Search topics..."
                            value={topicSearch}
                            onChange={(e) => setTopicSearch(e.target.value)}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                            onClick={() => {
                                if (preferences.selected_topic_ids.length === topics.length) {
                                    // Deselect all
                                    setPreferences((prev) => ({ ...prev, selected_topic_ids: [] }));
                                } else {
                                    // Select all
                                    setPreferences((prev) => ({ ...prev, selected_topic_ids: topics.map(t => t.id) }));
                                }
                            }}
                            className="px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                            {preferences.selected_topic_ids.length === topics.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {/* Topics Grid */}
                    {topics.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No topics available</p>
                    ) : filteredTopics.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No topics match your search</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredTopics.map((topic) => {
                                const isSelected = preferences.selected_topic_ids.includes(topic.id);
                                return (
                                    <button
                                        key={topic.id}
                                        onClick={() => toggleTopic(topic.id)}
                                        className={`p-3 rounded-md border text-sm font-medium transition-colors text-left relative ${
                                            isSelected
                                                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="absolute top-1 right-1 text-amber-400">✓</span>
                                        )}
                                        <div className="font-medium">{topic.display_name}</div>
                                        {topic.description && (
                                            <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                {topic.description}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    
                    {preferences.selected_topic_ids.length === 0 && (
                        <p className="text-xs text-amber-400 mt-4 text-center">
                            ⚠️ Select at least one topic to see articles in your feed
                        </p>
                    )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-md bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            </div>
        </main>
    );
}





