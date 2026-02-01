/**
 * RSS Feed Fetcher Service
 * Fetches articles from RSS feeds and normalizes them for storage
 */

import Parser from 'rss-parser';

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsfeedBot/1.0)',
    },
});

export interface RSSArticle {
    title: string;
    url: string;
    publishTime: Date;
    description?: string;
    imageUrl?: string;
    rawData?: any;
}

export interface FetchResult {
    sourceId: string;
    sourceName: string;
    articlesFetched: number;
    articlesInserted: number;
    errors: string[];
}

/**
 * Fetch articles from an RSS feed URL
 */
export async function fetchRSSFeed(feedUrl: string): Promise<RSSArticle[]> {
    try {
        console.log(`Fetching RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        if (!feed.items || feed.items.length === 0) {
            console.log(`No items found in feed: ${feedUrl}`);
            return [];
        }

        const articles: RSSArticle[] = feed.items.map((item) => {
            // Parse publish date
            let publishTime = new Date();
            if (item.pubDate) {
                const parsed = new Date(item.pubDate);
                if (!isNaN(parsed.getTime())) {
                    publishTime = parsed;
                }
            } else if (item.isoDate) {
                const parsed = new Date(item.isoDate);
                if (!isNaN(parsed.getTime())) {
                    publishTime = parsed;
                }
            }

            // Extract image URL from content or enclosure
            let imageUrl: string | undefined;
            if (item.enclosures && item.enclosures.length > 0) {
                const imageEnclosure = item.enclosures.find(
                    (enc: any) => enc.type?.startsWith('image/')
                );
                if (imageEnclosure) {
                    imageUrl = imageEnclosure.url;
                }
            }
            
            // Try to extract image from content
            if (!imageUrl && item.content) {
                const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch) {
                    imageUrl = imgMatch[1];
                }
            }

            // Try to extract image from contentSnippet or description
            if (!imageUrl && (item.contentSnippet || item.description)) {
                const content = item.contentSnippet || item.description || '';
                const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch) {
                    imageUrl = imgMatch[1];
                }
            }

            return {
                title: item.title || 'Untitled',
                url: item.link || item.guid || '',
                publishTime,
                description: item.contentSnippet || item.description || undefined,
                imageUrl,
                rawData: item,
            };
        }).filter((article) => {
            // Filter out articles without valid URLs
            return article.url && article.url.trim().length > 0;
        });

        console.log(`Fetched ${articles.length} articles from ${feedUrl}`);
        return articles;
    } catch (error) {
        console.error(`Error fetching RSS feed ${feedUrl}:`, error);
        throw error;
    }
}

/**
 * Normalize URL to prevent duplicates (remove query params, fragments, etc.)
 */
export function normalizeUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // Remove common tracking parameters
        const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'fbclid', 'gclid'];
        paramsToRemove.forEach((param) => {
            urlObj.searchParams.delete(param);
        });
        // Remove fragment
        urlObj.hash = '';
        return urlObj.toString();
    } catch (error) {
        // If URL parsing fails, return original
        return url;
    }
}
